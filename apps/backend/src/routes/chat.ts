import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { addMessageToChat, createChat, getChatHistory } from "../services/chat";
import {
  webFetchTool,
  webSearchTool,
  webTools as availableWebTools,
} from "../ollama/tools/web";
import { ollamaClient } from "../ollama/client";
import { Message } from "ollama";
import { frame } from "../utils/frame";
import { convertImageIdsToBase64 } from "../utils/imageUtils";
import { PingOllama } from "../services/ollamaService";

const router = Router();

const chatValidation = [
  body("model").isString().notEmpty(),
  body("message").isObject(),
  body("message.role").isString().notEmpty(),
  body("message.content").isString().notEmpty(),
  body("message.images").optional().isArray(),
  body("message.images.*").isInt({ min: 1 }),
  body("conversationId").optional().isString(),
  body("think")
    .optional()
    .custom(
      (value) =>
        typeof value === "boolean" || ["low", "medium", "high"].includes(value)
    ),
  body("webTools").optional().isBoolean(),
];

router.post(
  "/chat/stream",
  chatValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      model,
      message: clientMessage,
      conversationId,
      think,
      webTools,
    } = req.body as {
      model: string;
      message: { role: string; content: string; images?: string[] };
      conversationId?: string;
      think?: boolean | "low" | "medium" | "high";
      webTools?: boolean;
    };

    const ollamaPing = await PingOllama();
    if (!ollamaPing) {
      return res.status(500).json({ error: "Could not connect to OLLAMA" });
    }

    // ---- Headers for streaming ----
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
      // ---- Send start frame ----
      res.write(frame("start"));

      // ---- Create / resolve conversation ----
      let convId = conversationId;
      if (!convId) {
        const chatRes = await createChat({
          title: clientMessage.content.slice(0, 20),
          model,
        });
        convId = chatRes.toString();
        console.log("new chat created", convId, clientMessage.content);
        // ---- Send meta frame FIRST ----
        res.write(
          frame("conversationId", {
            value: convId,
          })
        );
      }

      // ---- Load history ----
      const chatHistory: Array<Message> = [];

      if (conversationId) {
        console.log("fetching history from database...");
        const results = await getChatHistory(+conversationId);
        const mappedResults = await Promise.all(
          results.map(async (r) => {
            let base64Images;
            if (r.images && r.images.split(",").length > 0) {
              try {
                const ids = r.images.split(",");
                base64Images = await convertImageIdsToBase64(ids);
              } catch (error) {
                console.error("Error processing images:", error);
                // Continue without images if conversion fails
              }
            }
            return {
              role: r.role,
              content: r.content,
              thinking: r.thinking ?? undefined,
              tool_calls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined,
              tool_name: r.tool_name ?? undefined,
              images: base64Images,
            };
          })
        );
        chatHistory.push(...mappedResults);
      }

      console.log("Persisting user message...");

      let clientImagesBase64;
      if (clientMessage.images && clientMessage.images.length) {
        clientImagesBase64 = await convertImageIdsToBase64(
          clientMessage.images
        );
      }
      const userMessage = {
        role: clientMessage.role,
        content: clientMessage.content,
      };

      chatHistory.push({ ...userMessage, images: clientImagesBase64 });
      // ---- Persist user message ----
      addMessageToChat({
        ...userMessage,
        conversation_id: +convId,
        images: clientMessage.images?.toString(),
      });

      while (true) {
        // ---- Stream model output ----
        const ollamaResponse = await ollamaClient.chat({
          model,
          messages: [...chatHistory],
          stream: true,
          think: think ?? false,
          tools: [...(webTools ? [webSearchTool, webFetchTool] : [])],
        } as any);

        let fullReply = "";
        let thinkingResponse = "";
        let inThinking = false;
        let hadToolCalls = false;
        let metadata: { [key: string]: any } = {};

        console.log("Start streaming");
        res.write(frame("role", { value: "assistant" }));
        for await (const part of ollamaResponse) {
          // console.log("part", part);
          if (part.message.thinking && !inThinking) {
            inThinking = true;
            console.log("Thinking...\n");
            res.write(
              frame("isThinking", {
                value: true,
              })
            );
          }
          if (part.message.thinking) {
            thinkingResponse += part.message.thinking;
            res.write(
              frame("thinking", {
                value: part.message.thinking,
              })
            );
          }
          if (part.message.content) {
            if (inThinking) {
              inThinking = false;
              res.write(
                frame("isThinking", {
                  value: false,
                })
              );
            }
            const token = part.message.content;
            fullReply += token;
            res.write(
              frame("token", {
                value: token,
              })
            );
          }
          if (part.message.tool_calls && part.message.tool_calls.length > 0) {
            if (inThinking) {
              inThinking = false;
              res.write(
                frame("isThinking", {
                  value: false,
                })
              );
            }
            hadToolCalls = true;
            const assistantMessage = {
              role: "assistant",
              content: fullReply,
              thinking: thinkingResponse,
            };
            chatHistory.push({
              ...assistantMessage,
              tool_calls: part.message.tool_calls,
            });
            addMessageToChat({
              ...assistantMessage,
              conversation_id: +convId,
              tool_calls: JSON.stringify(part.message.tool_calls),
              metadata: JSON.stringify(metadata),
            });
            // Execute tools and append tool results
            for (const toolCall of part.message.tool_calls) {
              const functionToCall =
                availableWebTools[
                  // typescript :D
                  toolCall.function.name as keyof typeof availableWebTools
                ];
              if (functionToCall) {
                const args = toolCall.function.arguments as any;
                console.log(
                  "\nCalling function:",
                  toolCall.function.name,
                  "with arguments:",
                  args
                );

                const output = await functionToCall(args);

                res.write(frame("role", { value: "tool" }));
                res.write(
                  frame("toolName", {
                    value: toolCall.function.name,
                  })
                );
                res.write(
                  frame("toolValue", {
                    value: JSON.stringify(output).slice(0, 200),
                  })
                );
                console.log(toolCall.function.name, "returned result", "\n");
                const toolMessage = {
                  role: "tool",
                  content: JSON.stringify(output),
                };
                chatHistory.push({
                  ...toolMessage,
                  tool_name: toolCall.function.name,
                });
                addMessageToChat({
                  ...toolMessage,
                  conversation_id: +convId,
                  tool_name: toolCall.function.name.toString(),
                  tool_calls: undefined,
                });
              }
            }
          }
          if (part.done) {
            metadata = {
              total_duration: part.total_duration,
              load_duration: part.load_duration,
              prompt_eval_count: part.prompt_eval_count,
              prompt_eval_duration: part.prompt_eval_duration,
              eval_count: part.eval_count,
              eval_duration: part.eval_duration,
              done: part.done,
              done_reason: part.done_reason,
              model: part.model,
            };
          }
        }

        if (!hadToolCalls) {
          console.log("Streaming about to end...");
          // ---- End frame ----
          res.write(frame("end"));
          res.end();
          // ---- Persist assistant reply ----
          await addMessageToChat({
            conversation_id: +convId,
            content: fullReply,
            role: "assistant",
            thinking: thinkingResponse,
            metadata: JSON.stringify(metadata),
          });

          break;
        }
      }
    } catch (err) {
      console.error(err);

      // Check if headers have already been sent (streaming started)
      if (res.headersSent) {
        // Write error frame to stream and end it
        res.write(
          frame("error", {
            message:
              err instanceof Error ? err.message : "Internal server error",
          })
        );
        res.end();
      } else {
        // Headers not sent yet, can use regular JSON response
        res.status(500).json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
      }
    }
  }
);

export default router;
