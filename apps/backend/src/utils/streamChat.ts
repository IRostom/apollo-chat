/**
 * Streaming chat response utility
 * Encapsulates the Ollama streaming loop, tool execution, and frame writing
 */

import { Response } from "express";
import { AbortableAsyncIterator, ChatResponse, Message } from "ollama";
import { ollamaClient } from "../ollama/client";
import {
  webFetchTool,
  webSearchTool,
  webTools as availableWebTools,
} from "../ollama/tools/web";
import { codeTools, runCodeTool } from "../ollama/tools/code";
import { addMessageToChat } from "../services/chat";
import { frame } from "./frame";

export interface StreamChatOptions {
  res: Response;
  conversationId: number;
  model: string;
  chatHistory: Message[];
  think?: boolean | "low" | "medium" | "high";
  webTools?: boolean;
}

/**
 * Stream a chat response from Ollama to the client
 * Handles the streaming loop, tool execution, and error recovery
 * Automatically handles client disconnection by aborting the Ollama stream
 *
 * @throws Error if streaming fails (caller should handle)
 */
export async function streamChatResponse(
  options: StreamChatOptions
): Promise<void> {
  const { res, conversationId, model, chatHistory, think, webTools } = options;

  let fullReply = "";
  let thinkingResponse = "";
  let ollamaResponse: AbortableAsyncIterator<ChatResponse> | null = null;
  let isAborted = false;

  // Handle client disconnection (e.g., user clicked stop)
  const handleClose = async () => {
    if (isAborted) return; // Already handled
    isAborted = true;
    console.log("Client disconnected, aborting stream...");

    // Abort the Ollama stream
    if (ollamaResponse) {
      ollamaResponse.abort();
    }

    // Save partial response if any content was generated
    if (fullReply || thinkingResponse) {
      try {
        await addMessageToChat({
          conversation_id: conversationId,
          content: fullReply ?? "",
          role: "assistant",
          thinking: thinkingResponse || undefined,
          metadata: JSON.stringify({
            done: false,
            done_reason: "user_stopped",
          }),
        });
        console.log("Partial response saved after user stop");
      } catch (saveError) {
        console.error("Failed to save partial response:", saveError);
      }
    }
  };

  // Register close handler
  res.on("close", handleClose);

  try {
    while (true) {
      // Check if aborted before starting new iteration
      if (isAborted) {
        break;
      }
      // ---- Stream model output ----
      const tools = [
        runCodeTool,
        ...(webTools ? [webSearchTool, webFetchTool] : []),
      ];

      ollamaResponse = await ollamaClient.chat({
        model,
        messages: [...chatHistory],
        stream: true,
        think: think ?? false,
        tools,
      } as any);

      // Reset for each iteration (tool call loop)
      fullReply = "";
      thinkingResponse = "";
      let inThinking = false;
      let hadToolCalls = false;
      let metadata: { [key: string]: any } = {};

      console.log("Start streaming");
      res.write(frame("role", { value: "assistant" }));

      for await (const part of ollamaResponse) {
        // Handle thinking state transitions
        if (part.message.thinking && !inThinking) {
          inThinking = true;
          console.log("Thinking...\n");
          res.write(frame("isThinking", { value: true }));
        }

        if (part.message.thinking) {
          thinkingResponse += part.message.thinking;
          res.write(frame("thinking", { value: part.message.thinking }));
        }

        if (part.message.content) {
          if (inThinking) {
            inThinking = false;
            res.write(frame("isThinking", { value: false }));
          }
          const token = part.message.content;
          fullReply += token;
          res.write(frame("token", { value: token }));
        }

        // Handle tool calls
        if (part.message.tool_calls && part.message.tool_calls.length > 0) {
          if (inThinking) {
            inThinking = false;
            res.write(frame("isThinking", { value: false }));
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

          await addMessageToChat({
            ...assistantMessage,
            conversation_id: conversationId,
            tool_calls: JSON.stringify(part.message.tool_calls),
            metadata: JSON.stringify(metadata),
          });

          // Execute tools and append tool results
          for (const toolCall of part.message.tool_calls) {
            const availableTools = {
              ...(webTools ? availableWebTools : {}),
              ...codeTools,
            };
            const functionToCall =
              availableTools[
                toolCall.function.name as keyof typeof availableTools
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
              res.write(frame("toolName", { value: toolCall.function.name }));
              if (toolCall.function.name === "runCode") {
                if (typeof args?.language === "string") {
                  res.write(frame("codeLanguage", { value: args.language }));
                }
                if (typeof args?.code === "string") {
                  res.write(frame("codeContent", { value: args.code }));
                }
              }
              res.write(frame("toolValue", { value: JSON.stringify(output) }));

              console.log(toolCall.function.name, "returned result", "\n");

              const toolMessage = {
                role: "tool",
                content: JSON.stringify(output),
              };

              chatHistory.push({
                ...toolMessage,
                tool_name: toolCall.function.name,
              });

              await addMessageToChat({
                ...toolMessage,
                conversation_id: conversationId,
                tool_name: toolCall.function.name.toString(),
                tool_calls: undefined,
              });
            }
          }
        }

        // Capture metadata when done
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

      // If no tool calls, we're done streaming
      if (!hadToolCalls) {
        // Check if aborted before saving
        if (isAborted) {
          break;
        }

        console.log("Streaming about to end...");
        // Persist assistant reply
        await addMessageToChat({
          conversation_id: conversationId,
          content: fullReply,
          role: "assistant",
          thinking: thinkingResponse,
          metadata: JSON.stringify(metadata),
        });

        res.write(frame("end"));
        res.end();
        break;
      }
      // Otherwise, loop continues with tool results added to history
    }
  } catch (err) {
    // If aborted by user, the close handler already saved partial response
    if (isAborted) {
      console.log("Stream aborted by user");
      return;
    }

    console.error(err);

    // Abort ongoing Ollama stream to free resources
    if (ollamaResponse) {
      ollamaResponse.abort();
    }

    // Save partial response to DB before ending
    await addMessageToChat({
      conversation_id: conversationId,
      content: fullReply ?? "",
      role: "assistant",
      thinking: thinkingResponse || undefined,
      metadata: JSON.stringify({
        done: false,
        done_reason: "server_error",
      }),
    });

    // Write error frame to stream and end it
    res.write(
      frame("error", {
        message: err instanceof Error ? err.message : "Internal server error",
      })
    );
    res.end();
  } finally {
    // Clean up the close handler
    res.off("close", handleClose);
  }
}
