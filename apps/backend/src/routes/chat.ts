import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import {
  addMessageToChat,
  createChat,
  getChatHistory,
  getMessageById,
  deleteMessagesAfterUserMessage,
} from "../services/chat";
import { Message } from "ollama";
import { frame } from "../utils/frame";
import { convertImageIdsToBase64 } from "../utils/imageUtils";
import { PingOllama } from "../services/ollamaService";
import { streamChatResponse } from "../utils/streamChat";

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

const retryValidation = [
  body("messageId").isInt({ min: 1 }),
  body("conversationId").isString().notEmpty(),
  body("model").isString().notEmpty(),
  body("think")
    .optional()
    .custom(
      (value) =>
        typeof value === "boolean" || ["low", "medium", "high"].includes(value)
    ),
  body("webTools").optional().isBoolean(),
];

/**
 * Helper to load chat history from database and convert to Ollama Message format
 */
async function loadChatHistory(conversationId: number): Promise<Message[]> {
  const results = await getChatHistory(conversationId);
  return Promise.all(
    results.map(async (r) => {
      let base64Images;
      if (r.images && r.images.split(",").length > 0) {
        try {
          const ids = r.images.split(",");
          base64Images = await convertImageIdsToBase64(ids);
        } catch (error) {
          console.error("Error processing images:", error);
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
}

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

    let convId = conversationId;

    try {
      // ---- Send start frame ----
      res.write(frame("start"));

      // ---- Create / resolve conversation ----
      if (!convId) {
        const chatRes = await createChat({
          title: clientMessage.content.slice(0, 20),
          model,
        });
        convId = chatRes.toString();
        console.log("new chat created", convId, clientMessage.content);
        res.write(frame("conversationId", { value: convId }));
      }

      // ---- Load history ----
      const chatHistory: Message[] = conversationId
        ? await loadChatHistory(+conversationId)
        : [];

      // ---- Process and persist user message ----
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

      addMessageToChat({
        ...userMessage,
        conversation_id: +convId,
        images: clientMessage.images?.toString(),
      });

      // ---- Stream the response ----
      await streamChatResponse({
        res,
        conversationId: +convId,
        model,
        chatHistory,
        think,
        webTools,
      });
    } catch (err) {
      console.error(err);

      if (res.headersSent) {
        res.write(
          frame("error", {
            message:
              err instanceof Error ? err.message : "Internal server error",
          })
        );
        res.end();
      } else {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
      }
    }
  }
);

router.post(
  "/chat/stream/retry",
  retryValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { messageId, conversationId, model, think, webTools } = req.body as {
      messageId: number;
      conversationId: string;
      model: string;
      think?: boolean | "low" | "medium" | "high";
      webTools?: boolean;
    };

    // Validate assistant message exists and belongs to the conversation
    const assistantMessage = await getMessageById(messageId);
    if (!assistantMessage) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (assistantMessage.conversation_id !== +conversationId) {
      return res
        .status(400)
        .json({ error: "Message does not belong to this conversation" });
    }

    const ollamaPing = await PingOllama();
    if (!ollamaPing) {
      return res.status(500).json({ error: "Could not connect to OLLAMA" });
    }

    // Find the user message before the assistant message
    const allMessages = await getChatHistory(+conversationId);
    const assistantIndex = allMessages.findIndex((m) => m.id === messageId);
    if (assistantIndex === -1) {
      return res.status(404).json({ error: "Message not found in history" });
    }

    // Find the user message immediately before the assistant message
    let userMessage = null;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (allMessages[i].role === "user") {
        userMessage = allMessages[i];
        break;
      }
    }

    if (!userMessage || !userMessage.id) {
      return res
        .status(400)
        .json({ error: "No user message found before assistant message" });
    }

    // ---- Headers for streaming ----
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
      // ---- Send start frame ----
      res.write(frame("start"));

      // Delete all messages after the user message
      await deleteMessagesAfterUserMessage(+conversationId, userMessage.id);

      // Send invalidate frame to signal frontend to refresh cache
      res.write(frame("invalidate"));

      // ---- Load remaining history ----
      const chatHistory = await loadChatHistory(+conversationId);

      // ---- Stream the response ----
      await streamChatResponse({
        res,
        conversationId: +conversationId,
        model,
        chatHistory,
        think,
        webTools,
      });
    } catch (err) {
      console.error(err);

      if (res.headersSent) {
        res.write(
          frame("error", {
            message:
              err instanceof Error ? err.message : "Internal server error",
          })
        );
        res.end();
      } else {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
      }
    }
  }
);

export default router;
