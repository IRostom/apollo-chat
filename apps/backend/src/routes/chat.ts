import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import {
  addMessageToChat,
  createChat,
  getChatById,
  getChatHistory,
  getMessageById,
  deleteMessagesAfterUserMessage,
  updateMessageContent,
  getMessagesUpTo,
  copyMessagesToConversation,
} from "../services/chat";
import { type ProviderName } from "../providers";
import {
  streamChatResponse,
  processMessagesForRetry,
  processMessagesForEdit,
  type ChatMessage,
} from "../utils/streamChat";

const router = Router();

/**
 * AI SDK message format - messages can have parts array or content string
 */
interface AISDKMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
}

/**
 * Extract text content from an AI SDK message
 * Handles both direct content string and parts array format
 */
function extractMessageContent(message: AISDKMessage): string {
  // If content is a direct string, use it
  if (typeof message.content === "string" && message.content.length > 0) {
    return message.content;
  }

  // If message has parts, extract text from text parts
  if (message.parts && Array.isArray(message.parts)) {
    const textParts = message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string);

    if (textParts.length > 0) {
      return textParts.join("");
    }
  }

  return "";
}

/**
 * Trigger types for chat actions
 * Supports both our custom triggers and AI SDK's default triggers
 */
type ChatTrigger = "send" | "retry" | "edit" | "submit-message" | "regenerate-message";

interface ChatRequestBody {
  messages: ChatMessage[];
  provider: ProviderName;
  model: string;
  trigger?: ChatTrigger;
  data?: {
    messageId?: string;
    content?: string;
    conversationId?: string;
  };
  webTools?: boolean;
}

/**
 * Normalize AI SDK triggers to our internal triggers
 */
function normalizeTrigger(trigger?: ChatTrigger): "send" | "retry" | "edit" {
  switch (trigger) {
    case "submit-message":
    case "send":
      return "send";
    case "regenerate-message":
    case "retry":
      return "retry";
    case "edit":
      return "edit";
    default:
      return "send";
  }
}

/**
 * POST /api/chat
 * Main chat endpoint with trigger-based routing
 * Supports: send (new message), retry (regenerate), edit (update and regenerate)
 * Also supports AI SDK triggers: submit-message, regenerate-message
 */
const apiChatValidation = [
  body("messages").isArray(),
  body("provider").isString().notEmpty(),
  body("model").isString().notEmpty(),
  body("trigger").optional().isIn(["send", "retry", "edit", "submit-message", "regenerate-message"]),
  body("data").optional().isObject(),
  body("webTools").optional().isBoolean(),
];

router.post(
  "/api/chat",
  apiChatValidation,
  async (req: Request, res: Response) => {
    // Debug logging to see what's being received
    console.log("Chat API received body:", JSON.stringify(req.body, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      messages,
      provider,
      model,
      trigger: rawTrigger,
      data,
      webTools,
    } = req.body as ChatRequestBody;

    // Normalize AI SDK triggers to our internal triggers
    const trigger = normalizeTrigger(rawTrigger);

    let processedMessages = messages;
    let conversationId = data?.conversationId
      ? parseInt(data.conversationId, 10)
      : undefined;

    try {
      // Handle different triggers
      switch (trigger) {
        case "retry": {
          if (!data?.messageId) {
            return res
              .status(400)
              .json({ error: "messageId required for retry" });
          }
          processedMessages = processMessagesForRetry(messages, data.messageId);

          // Delete messages from database
          if (conversationId) {
            const messageIdNum = parseInt(data.messageId, 10);
            await deleteMessagesAfterUserMessage(conversationId, messageIdNum);
          }
          break;
        }

        case "edit": {
          if (!data?.messageId || !data?.content) {
            return res
              .status(400)
              .json({ error: "messageId and content required for edit" });
          }
          processedMessages = processMessagesForEdit(
            messages,
            data.messageId,
            data.content
          );

          // Update message in database and delete subsequent
          if (conversationId) {
            const messageIdNum = parseInt(data.messageId, 10);
            await updateMessageContent(
              messageIdNum,
              conversationId,
              data.content
            );
            await deleteMessagesAfterUserMessage(conversationId, messageIdNum);
          }
          break;
        }

        case "send":
        default: {
          // Create conversation if needed
          if (!conversationId && processedMessages.length > 0) {
            const firstMessage = processedMessages[0] as AISDKMessage;
            const content = extractMessageContent(firstMessage);
            const title = content.slice(0, 20) || "New conversation";

            conversationId = await createChat({
              title,
              model,
              provider,
            });
            console.log("New conversation created:", conversationId);
          }

          // Persist the user message (last message in the array)
          if (conversationId && processedMessages.length > 0) {
            const lastMessage = processedMessages[
              processedMessages.length - 1
            ] as AISDKMessage;
            if (lastMessage.role === "user") {
              const content = extractMessageContent(lastMessage);
              if (content) {
                await addMessageToChat({
                  conversation_id: conversationId,
                  content,
                  role: "user",
                });
              }
            }
          }
          break;
        }
      }

      // Stream the response
      await streamChatResponse({
        res,
        conversationId: conversationId || 0,
        provider,
        model,
        messages: processedMessages,
        webTools,
      });
    } catch (err) {
      console.error("Chat API error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
      }
    }
  }
);

/**
 * POST /chat/branch
 * Branch a conversation from a specific message
 */
const branchValidation = [
  body("messageId").isInt({ min: 1 }),
  body("conversationId").isString().notEmpty(),
];

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

      // Get the model and provider from the original conversation
      const originalChat = await getChatById(+conversationId);
      if (!originalChat) {
        return res
          .status(404)
          .json({ error: "Original conversation not found" });
      }

      // Create the new conversation
      const newConversationId = await createChat({
        title: `${title} (branch)`,
        model: originalChat.model,
        provider: (originalChat as { provider?: string }).provider || "ollama",
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

// ============================================================================
// Legacy endpoints (kept for backward compatibility during migration)
// These can be removed once frontend is fully migrated to AI SDK
// ============================================================================

import { convertImageIdsToBase64 } from "../utils/imageUtils";

const legacyChatValidation = [
  body("model").isString().notEmpty(),
  body("message").isObject(),
  body("message.role").isString().notEmpty(),
  body("message.content").isString().notEmpty(),
  body("message.images").optional().isArray(),
  body("message.images.*").isInt({ min: 1 }),
  body("conversationId").optional().isString(),
  body("provider").optional().isString(),
  body("webTools").optional().isBoolean(),
];

/**
 * @deprecated Use POST /api/chat instead
 * Legacy chat endpoint for backward compatibility
 */
router.post(
  "/chat/stream",
  legacyChatValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      model,
      message: clientMessage,
      conversationId,
      provider = "ollama",
      webTools,
    } = req.body as {
      model: string;
      message: { role: string; content: string; images?: string[] };
      conversationId?: string;
      provider?: ProviderName;
      webTools?: boolean;
    };

    let convId = conversationId ? parseInt(conversationId, 10) : undefined;

    try {
      // Create conversation if needed
      if (!convId) {
        convId = await createChat({
          title: clientMessage.content.slice(0, 20),
          model,
          provider,
        });
        console.log("New conversation created:", convId);
      }

      // Process images if present
      let imageData: string[] | undefined;
      if (clientMessage.images && clientMessage.images.length) {
        imageData = await convertImageIdsToBase64(clientMessage.images);
      }

      // Persist user message
      await addMessageToChat({
        conversation_id: convId,
        content: clientMessage.content,
        role: clientMessage.role,
        images: clientMessage.images?.toString(),
      });

      // Load conversation history
      const historyMessages = await getChatHistory(convId);

      // Convert to ChatMessage format
      const chatMessages: ChatMessage[] = historyMessages.map((msg, index) => ({
        id: msg.id?.toString() || `msg-${index}`,
        role: msg.role as ChatMessage["role"],
        content: msg.content,
      }));

      // Stream the response
      await streamChatResponse({
        res,
        conversationId: convId,
        provider,
        model,
        messages: chatMessages,
        webTools,
      });
    } catch (err) {
      console.error("Legacy chat error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
      }
    }
  }
);

export default router;
