import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import {
  addMessageToChat,
  createChat,
  getChatById,
  getChatHistory,
  getMessageById,
  deleteMessagesAfterUserMessage,
  loadChatHistory,
  updateMessageContent,
  getMessagesUpTo,
  copyMessagesToConversation,
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

const editValidation = [
  body("messageId").isInt({ min: 1 }),
  body("conversationId").isString().notEmpty(),
  body("content").isString().notEmpty(),
  body("model").isString().notEmpty(),
  body("think")
    .optional()
    .custom(
      (value) =>
        typeof value === "boolean" || ["low", "medium", "high"].includes(value)
    ),
  body("webTools").optional().isBoolean(),
];

const branchValidation = [
  body("messageId").isInt({ min: 1 }),
  body("conversationId").isString().notEmpty(),
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
        // res.write(frame("conversationId", { value: convId }));
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

      await addMessageToChat({
        ...userMessage,
        conversation_id: +convId,
        images: clientMessage.images?.toString(),
      });

      if (!conversationId && convId) {
        res.write(frame("conversationId", { value: convId }));
      }

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
    const assistantMessage = await getMessageById(messageId, +conversationId);
    if (!assistantMessage) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (assistantMessage.role !== "assistant") {
      return res
        .status(400)
        .json({ error: "Message is not an assistant message" });
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

router.post(
  "/chat/stream/edit",
  editValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { messageId, conversationId, content, model, think, webTools } =
      req.body as {
        messageId: number;
        conversationId: string;
        content: string;
        model: string;
        think?: boolean | "low" | "medium" | "high";
        webTools?: boolean;
      };

    // Validate user message exists and belongs to the conversation
    const userMessage = await getMessageById(messageId, +conversationId);
    if (!userMessage) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (userMessage.role !== "user") {
      return res.status(400).json({ error: "Message is not a user message" });
    }

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

      // Update the user message content
      await updateMessageContent(messageId, +conversationId, content);

      // Delete all messages after the user message
      await deleteMessagesAfterUserMessage(+conversationId, messageId);

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

router.post(
  "/chat/branch",
  branchValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { messageId, conversationId } = req.body as {
      messageId: number;
      conversationId: string;
    };

    try {
      // Validate the message exists and belongs to the conversation
      const message = await getMessageById(messageId, +conversationId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Get all messages up to and including the specified message
      const messagesToCopy = await getMessagesUpTo(+conversationId, messageId);
      if (messagesToCopy.length === 0) {
        return res.status(400).json({ error: "No messages to copy" });
      }

      // Get the first user message content to use as the title
      const firstUserMessage = messagesToCopy.find((m) => m.role === "user");
      const title = firstUserMessage
        ? firstUserMessage.content.slice(0, 20)
        : "Branched conversation";

      // Get the model from the original conversation
      const originalChat = await getChatById(+conversationId);
      if (!originalChat) {
        return res.status(404).json({ error: "Original conversation not found" });
      }

      // Create the new conversation
      const newConversationId = await createChat({
        title: `${title} (branch)`,
        model: originalChat.model,
      });

      // Copy the messages to the new conversation
      await copyMessagesToConversation(messagesToCopy, newConversationId);

      return res.json({ conversationId: newConversationId.toString() });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  }
);

export default router;
