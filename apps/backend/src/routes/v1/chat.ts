import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  createIdGenerator,
} from "ai";
import type { UIMessage } from "ai";
import {
  getModel,
  isProviderConfigured,
  type Provider,
} from "../../providers/factory";
import { getEnabledTools } from "../../tools/sdkTools";
import {
  createAIConversation,
  getAIConversation,
  saveUIMessage,
  loadUIMessages,
  getMessageRows,
  deleteMessageRowsFromTimestamp,
  deleteAssistantMessageRowsFromTimestamp,
  deleteMessageRowsByIds,
  updateMessageRow,
} from "../../services/aiChat";
import { expandUIMessagesForProvider } from "../../services/filePartService";

const router = Router();
const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 });

// ============================================================================
// Type Definitions
// ============================================================================

type ResponseFormat = "ui" | "text";
type ApiProvider = Provider | "ollama-local";

function mapApiProvider(provider: ApiProvider): Provider {
  return provider === "ollama-local" ? "ollama" : provider;
}

interface ChatRequestBody {
  provider: ApiProvider;
  model: string;
  /** Full UIMessage from the frontend Chat class */
  message?: UIMessage;
  conversationId?: string;
  systemPrompt?: string;
  enableWebTools?: boolean;
  enableCodeTools?: boolean;
  enableThinking?: boolean;
  responseFormat?: ResponseFormat;
  trigger?: "submit-message" | "regenerate-message";
  messageId?: string;
}

interface EditRequestBody {
  provider: ApiProvider;
  model: string;
  /** UIMessage ID (string) of the user message to edit */
  messageId: string;
  conversationId: string;
  content: string;
  enableWebTools?: boolean;
  enableCodeTools?: boolean;
  enableThinking?: boolean;
  responseFormat?: ResponseFormat;
}

// ============================================================================
// Validation
// ============================================================================

const chatValidation = [
  body("trigger")
    .optional()
    .isIn(["submit-message", "regenerate-message"])
    .withMessage("trigger must be 'submit-message' or 'regenerate-message'"),
  body("provider")
    .isString()
    .isIn([
      "openai",
      "google",
      "anthropic",
      "ollama",
      "ollama-local",
      "ollama-cloud",
    ])
    .withMessage(
      "Provider must be one of: openai, google, anthropic, ollama, ollama-local, ollama-cloud",
    ),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("message").optional().isObject().withMessage("Message must be an object"),
  body("message.role")
    .optional()
    .equals("user")
    .withMessage("Message role must be 'user'"),
  body("message.parts")
    .optional()
    .isArray()
    .withMessage("Message parts must be an array"),
  body("conversationId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("conversationId must be a positive integer"),
  body("messageId").optional().isString(),
  body("systemPrompt").optional().isString(),
  body("enableWebTools").optional().isBoolean(),
  body("enableCodeTools").optional().isBoolean(),
  body("enableThinking").optional().isBoolean(),
  body("responseFormat")
    .optional()
    .isIn(["ui", "text"])
    .withMessage("responseFormat must be 'ui' or 'text'"),
];

const editValidation = [
  body("provider")
    .isString()
    .isIn([
      "openai",
      "google",
      "anthropic",
      "ollama",
      "ollama-local",
      "ollama-cloud",
    ])
    .withMessage(
      "Provider must be one of: openai, google, anthropic, ollama, ollama-local, ollama-cloud",
    ),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("messageId").isString().notEmpty().withMessage("messageId is required"),
  body("conversationId")
    .isInt({ min: 1 })
    .withMessage("conversationId must be a positive integer"),
  body("content").isString().notEmpty().withMessage("content is required"),
  body("enableWebTools").optional().isBoolean(),
  body("enableCodeTools").optional().isBoolean(),
  body("enableThinking").optional().isBoolean(),
  body("responseFormat")
    .optional()
    .isIn(["ui", "text"])
    .withMessage("responseFormat must be 'ui' or 'text'"),
];

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/v1/chat
 *
 * Receives the last user UIMessage from the frontend Chat class,
 * loads previous messages from DB, converts to ModelMessages for the model,
 * streams the response, and persists both the user and assistant UIMessages.
 */
router.post("/", chatValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    provider,
    model,
    message,
    conversationId,
    systemPrompt,
    enableWebTools = false,
    enableCodeTools = false,
    enableThinking = false,
    responseFormat = "ui",
    trigger = "submit-message",
    messageId,
  } = req.body as ChatRequestBody;

  const internalProvider = mapApiProvider(provider);

  if (!isProviderConfigured(internalProvider)) {
    return res.status(400).json({
      error: `Provider '${provider}' is not configured. Please set the required API key.`,
    });
  }

  if (trigger === "regenerate-message") {
    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const convId = parseInt(conversationId, 10);
    if (Number.isNaN(convId) || convId < 1) {
      return res
        .status(400)
        .json({ error: "conversationId must be a positive integer" });
    }

    try {
      // Load message rows with DB IDs
      const rows = await getMessageRows(convId);

      let targetIdx = -1;
      if (messageId) {
        targetIdx = rows.findIndex((r) => r.uiMessage.id === messageId);
      } else {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i].uiMessage.role === "assistant") {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx === -1) {
        return res.status(404).json({ error: "Assistant message not found" });
      }
      if (rows[targetIdx].uiMessage.role !== "assistant") {
        return res
          .status(400)
          .json({ error: "Can only retry assistant messages" });
      }

      // Delete all messages after the target (including target) for consistency
      const messageIdsToDelete = rows
        .slice(targetIdx)
        .map((row) => row.messageId);
      await deleteMessageRowsByIds(convId, messageIdsToDelete);

      // Remaining messages
    const remainingMessages = rows.slice(0, targetIdx).map((r) => r.uiMessage);

      // Get conversation for system prompt
      const conversation = await getAIConversation(convId);

      // Expand file parts for the target provider before conversion
      const expandedMessages = await expandUIMessagesForProvider(
        remainingMessages,
        provider,
      );

      // Convert to model messages
      const modelMessages = await convertToModelMessages(expandedMessages);

      // Get tools and model
      const tools = getEnabledTools({ enableCodeTools, enableWebTools });
      const modelInstance = getModel(internalProvider, model, {
        think: enableThinking,
      });

      // Stream the response
      const result = streamText({
        model: modelInstance as any,
        messages: modelMessages as any,
        system: conversation?.system_prompt ?? undefined,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        stopWhen: stepCountIs(10),
        onError: ({ error }) => {
          console.error("Stream error:", error);
        },
      });

      if (responseFormat === "text") {
        result.pipeTextStreamToResponse(res);
      void Promise.resolve(result.text as Promise<string>)
        .then(async (fullText) => {
          try {
            const usage = await result.usage;
            const responseMessage: UIMessage = {
              id: generateMessageId(),
              role: "assistant",
              parts: [{ type: "text" as const, text: fullText }],
            };
            await saveUIMessage(convId, responseMessage, { usage });
            console.log("Regenerate text completed:", { convId, usage });
          } catch (err) {
            console.error("Failed to persist regenerate text response:", err);
          }
        })
        .catch((err: unknown) =>
          console.error("Regenerate text stream error:", err),
        );
      } else {
        result.pipeUIMessageStreamToResponse(res, {
          sendReasoning: true,
          sendSources: true,
          originalMessages: remainingMessages,
          generateMessageId,
          onFinish: async ({ responseMessage, finishReason }) => {
            const usage = await result.usage;
            await saveUIMessage(convId, responseMessage, {
              usage,
              finishReason,
            });
            console.log("Regenerate completed:", { convId, finishReason, usage });
          },
        });
      }

      result.consumeStream();
    } catch (err) {
      console.error("Regenerate error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
      }
    }

    return;
  }

  let convId: number | null = null;
  if (conversationId) {
    const parsed = parseInt(conversationId, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return res
        .status(400)
        .json({ error: "conversationId must be a positive integer" });
    }
    convId = parsed;
  }

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }
  if (message.role !== "user") {
    return res.status(400).json({ error: "Message role must be 'user'" });
  }
  if (!Array.isArray(message.parts)) {
    return res.status(400).json({ error: "Message parts must be an array" });
  }

  try {
    // Create conversation if needed
    if (!convId) {
      const titleText =
        message.parts
          ?.filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("")
          .slice(0, 50) || "New Chat";
      convId = await createAIConversation({
        title: titleText,
        provider: internalProvider,
        model,
        system_prompt: systemPrompt,
      });
      console.log("New AI conversation created:", convId);
    } else {
      const existing = await getAIConversation(convId);
      if (!existing) {
        return res.status(404).json({ error: "Conversation not found" });
      }
    }

    // Load existing UIMessages from DB
    const previousMessages = await loadUIMessages(convId);

    // Save the new user UIMessage to DB
    await saveUIMessage(convId, message);

    // Combine all messages
    const allMessages = [...previousMessages, message];

    // Expand file parts for the target provider before conversion
    const expandedMessages = await expandUIMessagesForProvider(
      allMessages,
      provider,
    );

    // Convert UIMessages → ModelMessages for the model
    const modelMessages = await convertToModelMessages(expandedMessages);

    // Get tools and model instance
    const tools = getEnabledTools({ enableCodeTools, enableWebTools });
    const modelInstance = getModel(internalProvider, model, {
      think: enableThinking,
    });

    const conversationIdForCallback = convId;

    // Stream the response
    const result = streamText({
      model: modelInstance as any,
      messages: modelMessages as any,
      system: systemPrompt,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(10),
      onError: ({ error }) => {
        console.error("Stream error:", error);
      },
    });

    // Set conversation ID header for new conversations
    if (!conversationId) {
      res.setHeader("X-Conversation-Id", convId.toString());
    }

    if (responseFormat === "text") {
      result.pipeTextStreamToResponse(res);
      void Promise.resolve(result.text as Promise<string>)
        .then(async (fullText) => {
          try {
            const usage = await result.usage;
            const responseMessage: UIMessage = {
              id: generateMessageId(),
              role: "assistant",
              parts: [{ type: "text" as const, text: fullText }],
            };
            await saveUIMessage(
              conversationIdForCallback,
              responseMessage,
              { usage },
            );
            console.log("Text chat completed:", {
              convId: conversationIdForCallback,
              usage,
            });
          } catch (err) {
            console.error("Failed to persist text response:", err);
          }
        })
        .catch((err: unknown) => console.error("Text stream error:", err));
    } else {
      // Pipe UI message stream with persistence in onFinish
      result.pipeUIMessageStreamToResponse(res, {
        sendReasoning: true,
        sendSources: true,
        originalMessages: allMessages,
        generateMessageId,
        onFinish: async ({ responseMessage, finishReason }) => {
          const usage = await result.usage;
          await saveUIMessage(conversationIdForCallback, responseMessage, {
            usage,
            finishReason,
          });
          console.log("Chat completed:", {
            convId: conversationIdForCallback,
            finishReason,
            usage,
          });
        },
      });
    }

    // Ensure the stream runs to completion even if the client disconnects.
    // This guarantees the onFinish callback fires and messages are persisted.
    result.consumeStream();
  } catch (err) {
    console.error("Chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  }
});

/**
 * POST /api/v1/chat/edit
 * Edit a user message and regenerate the response.
 * Updates the user message content, deletes everything after it, and regenerates.
 */
router.post("/edit", editValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    provider,
    model,
    messageId,
    conversationId,
    content,
    enableWebTools = false,
    enableCodeTools = false,
    enableThinking = false,
    responseFormat = "ui",
  } = req.body as EditRequestBody;

  const convId = parseInt(conversationId, 10);
  if (Number.isNaN(convId) || convId < 1) {
    return res
      .status(400)
      .json({ error: "conversationId must be a positive integer" });
  }

  const internalProvider = mapApiProvider(provider);

  if (!isProviderConfigured(internalProvider)) {
    return res.status(400).json({
      error: `Provider '${provider}' is not configured. Please set the required API key.`,
    });
  }

  try {
    // Load message rows with DB IDs
    const rows = await getMessageRows(convId);
    const targetIdx = rows.findIndex((r) => r.uiMessage.id === messageId);

    if (targetIdx === -1) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (rows[targetIdx].uiMessage.role !== "user") {
      return res.status(400).json({ error: "Can only edit user messages" });
    }

    // Update the user message content, preserving non-text parts (images, files)
    const originalParts = rows[targetIdx].uiMessage.parts ?? [];
    let textReplaced = false;
    const updatedParts = originalParts.map((p) => {
      if (p.type === "text" && !textReplaced) {
        textReplaced = true;
        return { type: "text" as const, text: content };
      }
      return p;
    });
    if (!textReplaced) {
      updatedParts.push({ type: "text" as const, text: content });
    }
    const updatedMessage: UIMessage = {
      ...rows[targetIdx].uiMessage,
      parts: updatedParts,
    };
    await updateMessageRow(rows[targetIdx].messageId, updatedMessage);

    // Delete everything after the edited message
    if (targetIdx + 1 < rows.length) {
      const messageIdsToDelete = rows
        .slice(targetIdx + 1)
        .map((row) => row.messageId);
      await deleteMessageRowsByIds(convId, messageIdsToDelete);
    }

    // Remaining messages
    const remainingMessages = [
      ...rows.slice(0, targetIdx).map((r) => r.uiMessage),
      updatedMessage,
    ];

    // Get conversation for system prompt
    const conversation = await getAIConversation(convId);

    // Expand file parts for the target provider before conversion
    const expandedMessages = await expandUIMessagesForProvider(
      remainingMessages,
      provider,
    );

    // Convert to model messages
    const modelMessages = await convertToModelMessages(expandedMessages);

    // Get tools and model
    const tools = getEnabledTools({ enableCodeTools, enableWebTools });
    const modelInstance = getModel(internalProvider, model, {
      think: enableThinking,
    });

    // Stream the response
    const result = streamText({
      model: modelInstance as any,
      messages: modelMessages as any,
      system: conversation?.system_prompt ?? undefined,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(10),
      onError: ({ error }) => {
        console.error("Stream error:", error);
      },
    });

    if (responseFormat === "text") {
      result.pipeTextStreamToResponse(res);
      void Promise.resolve(result.text as Promise<string>)
        .then(async (fullText) => {
          try {
            const usage = await result.usage;
            const responseMessage: UIMessage = {
              id: generateMessageId(),
              role: "assistant",
              parts: [{ type: "text" as const, text: fullText }],
            };
            await saveUIMessage(convId, responseMessage, { usage });
            console.log("Edit text completed:", { convId, usage });
          } catch (err) {
            console.error("Failed to persist edit text response:", err);
          }
        })
        .catch((err: unknown) =>
          console.error("Edit text stream error:", err),
        );
    } else {
      result.pipeUIMessageStreamToResponse(res, {
        sendReasoning: true,
        sendSources: true,
        originalMessages: remainingMessages,
        generateMessageId,
        onFinish: async ({ responseMessage, finishReason }) => {
          const usage = await result.usage;
          await saveUIMessage(convId, responseMessage, {
            usage,
            finishReason,
          });
          console.log("Edit completed:", { convId, finishReason, usage });
        },
      });
    }

    result.consumeStream();
  } catch (err) {
    console.error("Edit error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  }
});

export default router;
