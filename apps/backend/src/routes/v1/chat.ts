import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
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
  deleteMessageRowsFrom,
  updateMessageRow,
} from "../../services/aiChat";

const router = Router();

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
  message: UIMessage;
  conversationId?: string;
  systemPrompt?: string;
  enableWebTools?: boolean;
  enableCodeTools?: boolean;
  enableThinking?: boolean;
  responseFormat?: ResponseFormat;
}

interface RetryRequestBody {
  provider: ApiProvider;
  model: string;
  /** UIMessage ID (string) of the assistant message to retry */
  messageId: string;
  conversationId: string;
  enableWebTools?: boolean;
  enableCodeTools?: boolean;
  enableThinking?: boolean;
  responseFormat?: ResponseFormat;
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
      "Provider must be one of: openai, google, anthropic, ollama, ollama-local, ollama-cloud"
    ),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("message").isObject().withMessage("Message must be an object"),
  body("message.role")
    .equals("user")
    .withMessage("Message role must be 'user'"),
  body("message.parts")
    .isArray()
    .withMessage("Message parts must be an array"),
  body("conversationId").optional().isString(),
  body("systemPrompt").optional().isString(),
  body("enableWebTools").optional().isBoolean(),
  body("enableCodeTools").optional().isBoolean(),
  body("enableThinking").optional().isBoolean(),
  body("responseFormat")
    .optional()
    .isIn(["ui", "text"])
    .withMessage("responseFormat must be 'ui' or 'text'"),
];

const retryValidation = [
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
      "Provider must be one of: openai, google, anthropic, ollama, ollama-local, ollama-cloud"
    ),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("messageId")
    .isString()
    .notEmpty()
    .withMessage("messageId is required"),
  body("conversationId")
    .isString()
    .notEmpty()
    .withMessage("conversationId is required"),
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
      "Provider must be one of: openai, google, anthropic, ollama, ollama-local, ollama-cloud"
    ),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("messageId")
    .isString()
    .notEmpty()
    .withMessage("messageId is required"),
  body("conversationId")
    .isString()
    .notEmpty()
    .withMessage("conversationId is required"),
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
  } = req.body as ChatRequestBody;

  const internalProvider = mapApiProvider(provider);

  if (!isProviderConfigured(internalProvider)) {
    return res.status(400).json({
      error: `Provider '${provider}' is not configured. Please set the required API key.`,
    });
  }

  let convId = conversationId ? parseInt(conversationId, 10) : null;

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
    }

    // Load existing UIMessages from DB
    const previousMessages = await loadUIMessages(convId);

    // Save the new user UIMessage to DB
    await saveUIMessage(convId, message);

    // Combine all messages
    const allMessages = [...previousMessages, message];

    // Convert UIMessages → ModelMessages for the model
    const modelMessages = await convertToModelMessages(allMessages);

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
    } else {
      // Pipe UI message stream with persistence in onFinish
      result.pipeUIMessageStreamToResponse(res, {
        sendReasoning: true,
        sendSources: true,
        originalMessages: allMessages,
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
 * POST /api/v1/chat/retry
 * Retry the last assistant message.
 * Deletes the assistant message (and everything after it) and regenerates.
 */
router.post("/retry", retryValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    provider,
    model,
    messageId,
    conversationId,
    enableWebTools = false,
    enableCodeTools = false,
    enableThinking = false,
    responseFormat = "ui",
  } = req.body as RetryRequestBody;

  const convId = parseInt(conversationId, 10);

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
    if (rows[targetIdx].uiMessage.role !== "assistant") {
      return res
        .status(400)
        .json({ error: "Can only retry assistant messages" });
    }

    // Delete the assistant message and everything after it
    await deleteMessageRowsFrom(convId, rows[targetIdx].dbId);

    // Remaining messages
    const remainingMessages = rows
      .slice(0, targetIdx)
      .map((r) => r.uiMessage);

    // Get conversation for system prompt
    const conversation = await getAIConversation(convId);

    // Convert to model messages
    const modelMessages = await convertToModelMessages(remainingMessages);

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
    } else {
      result.pipeUIMessageStreamToResponse(res, {
        sendReasoning: true,
        sendSources: true,
        originalMessages: remainingMessages,
        onFinish: async ({ responseMessage, finishReason }) => {
          const usage = await result.usage;
          await saveUIMessage(convId, responseMessage, {
            usage,
            finishReason,
          });
          console.log("Retry completed:", { convId, finishReason, usage });
        },
      });
    }

    result.consumeStream();
  } catch (err) {
    console.error("Retry error:", err);
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

    // Update the user message content
    const updatedMessage: UIMessage = {
      ...rows[targetIdx].uiMessage,
      parts: [{ type: "text" as const, text: content }],
    };
    await updateMessageRow(rows[targetIdx].dbId, updatedMessage);

    // Delete everything after the edited message
    if (targetIdx + 1 < rows.length) {
      await deleteMessageRowsFrom(convId, rows[targetIdx + 1].dbId);
    }

    // Remaining messages
    const remainingMessages = [
      ...rows.slice(0, targetIdx).map((r) => r.uiMessage),
      updatedMessage,
    ];

    // Get conversation for system prompt
    const conversation = await getAIConversation(convId);

    // Convert to model messages
    const modelMessages = await convertToModelMessages(remainingMessages);

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
    } else {
      result.pipeUIMessageStreamToResponse(res, {
        sendReasoning: true,
        sendSources: true,
        originalMessages: remainingMessages,
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
