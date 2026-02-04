import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { streamText, stepCountIs } from "ai";
import {
  getModel,
  isProviderConfigured,
  type Provider,
} from "../../providers/factory";
import { getEnabledTools } from "../../tools/sdkTools";
import {
  createAIConversation,
  getAIConversation,
  addAIMessage,
  loadAIMessagesAsCoreMessages,
  getAIMessageById,
  getAIMessages,
  deleteAIMessagesAfter,
  updateAIMessageContent,
} from "../../services/aiChat";

const router = Router();

// ============================================================================
// Type Definitions
// ============================================================================

type ResponseFormat = "ui" | "text";

interface ChatRequestBody {
  provider: Provider;
  model: string;
  message: {
    role: "user";
    content: string;
    attachments?: unknown[];
  };
  conversationId?: string;
  systemPrompt?: string;
  enableWebTools?: boolean;
  enableCodeTools?: boolean;
  responseFormat?: ResponseFormat;
}

interface RetryRequestBody {
  provider: Provider;
  model: string;
  messageId: number;
  conversationId: string;
  enableWebTools?: boolean;
  enableCodeTools?: boolean;
  responseFormat?: ResponseFormat;
}

interface EditRequestBody {
  provider: Provider;
  model: string;
  messageId: number;
  conversationId: string;
  content: string;
  enableWebTools?: boolean;
  enableCodeTools?: boolean;
  responseFormat?: ResponseFormat;
}

// ============================================================================
// Validation
// ============================================================================

const chatValidation = [
  body("provider")
    .isString()
    .isIn(["openai", "google", "anthropic", "ollama"])
    .withMessage("Provider must be one of: openai, google, anthropic, ollama"),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("message").isObject().withMessage("Message must be an object"),
  body("message.role")
    .equals("user")
    .withMessage("Message role must be 'user'"),
  body("message.content")
    .isString()
    .notEmpty()
    .withMessage("Message content is required"),
  body("message.attachments").optional().isArray(),
  body("conversationId").optional().isString(),
  body("systemPrompt").optional().isString(),
  body("enableWebTools").optional().isBoolean(),
  body("enableCodeTools").optional().isBoolean(),
  body("responseFormat")
    .optional()
    .isIn(["ui", "text"])
    .withMessage("responseFormat must be 'ui' or 'text'"),
];

const retryValidation = [
  body("provider")
    .isString()
    .isIn(["openai", "google", "anthropic", "ollama"])
    .withMessage("Provider must be one of: openai, google, anthropic, ollama"),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("messageId")
    .isInt({ min: 1 })
    .withMessage("messageId must be a positive integer"),
  body("conversationId")
    .isString()
    .notEmpty()
    .withMessage("conversationId is required"),
  body("enableWebTools").optional().isBoolean(),
  body("enableCodeTools").optional().isBoolean(),
  body("responseFormat")
    .optional()
    .isIn(["ui", "text"])
    .withMessage("responseFormat must be 'ui' or 'text'"),
];

const editValidation = [
  body("provider")
    .isString()
    .isIn(["openai", "google", "anthropic", "ollama"])
    .withMessage("Provider must be one of: openai, google, anthropic, ollama"),
  body("model").isString().notEmpty().withMessage("Model is required"),
  body("messageId")
    .isInt({ min: 1 })
    .withMessage("messageId must be a positive integer"),
  body("conversationId")
    .isString()
    .notEmpty()
    .withMessage("conversationId is required"),
  body("content").isString().notEmpty().withMessage("content is required"),
  body("enableWebTools").optional().isBoolean(),
  body("enableCodeTools").optional().isBoolean(),
  body("responseFormat")
    .optional()
    .isIn(["ui", "text"])
    .withMessage("responseFormat must be 'ui' or 'text'"),
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Pipe the AI SDK stream to the Express response using built-in methods
 */
function pipeStreamToResponse(
  result: any,
  res: Response,
  responseFormat: ResponseFormat
): void {
  if (responseFormat === "text") {
    result.pipeTextStreamToResponse(res);
  } else {
    result.pipeUIMessageStreamToResponse(res);
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/v1/chat
 * Stream a chat response from any supported AI provider
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
    responseFormat = "ui",
  } = req.body as ChatRequestBody;

  // Check if provider is configured
  if (!isProviderConfigured(provider)) {
    return res.status(400).json({
      error: `Provider '${provider}' is not configured. Please set the required API key.`,
    });
  }

  let convId = conversationId ? parseInt(conversationId, 10) : null;

  try {
    // Create or get conversation
    if (!convId) {
      convId = await createAIConversation({
        title: message.content.slice(0, 50),
        provider,
        model,
        system_prompt: systemPrompt,
      });
      console.log("New AI conversation created:", convId);
    }

    // Load existing messages
    const messages = convId ? await loadAIMessagesAsCoreMessages(convId) : [];

    // Add user message to history and database
    await addAIMessage({
      conversation_id: convId,
      role: "user",
      content: message.content,
      attachments: message.attachments,
    });

    // Add user message to messages array for the API call
    messages.push({
      role: "user",
      content: message.content,
    });

    // Get enabled tools
    const tools = getEnabledTools({ enableCodeTools, enableWebTools });

    // Get the model instance
    const modelInstance = getModel(provider, model);

    // Store convId for use in callbacks
    const conversationIdForCallback = convId;

    // Stream the response
    const result = streamText({
      model: modelInstance as any,
      messages: messages as any,
      system: systemPrompt,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(10),
      onFinish: async ({ text, toolCalls, usage, finishReason }) => {
        // Save assistant message to database
        await addAIMessage({
          conversation_id: conversationIdForCallback,
          role: "assistant",
          content: text,
          tool_invocations: toolCalls?.length ? toolCalls : undefined,
          metadata: { usage, finishReason },
        });

        console.log("Chat completed:", {
          convId: conversationIdForCallback,
          finishReason,
          usage,
        });
      },
      onError: ({ error }) => {
        console.error("Stream error:", error);
      },
    });

    // Set conversation ID header for new conversations
    if (!conversationId) {
      res.setHeader("X-Conversation-Id", convId.toString());
    }

    // Pipe the stream to the response using AI SDK helpers
    pipeStreamToResponse(result, res, responseFormat);
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
 * Retry the last assistant message
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
    responseFormat = "ui",
  } = req.body as RetryRequestBody;

  const convId = parseInt(conversationId, 10);

  // Check if provider is configured
  if (!isProviderConfigured(provider)) {
    return res.status(400).json({
      error: `Provider '${provider}' is not configured. Please set the required API key.`,
    });
  }

  try {
    // Verify the message exists and is an assistant message
    const message = await getAIMessageById(messageId, convId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.role !== "assistant") {
      return res
        .status(400)
        .json({ error: "Can only retry assistant messages" });
    }

    // Find the user message before this assistant message
    const allMessages = await getAIMessages(convId);
    const messageIndex = allMessages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) {
      return res
        .status(404)
        .json({ error: "Message not found in conversation" });
    }

    // Find the preceding user message
    let userMessageId: number | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (allMessages[i].role === "user") {
        userMessageId = allMessages[i].id;
        break;
      }
    }

    if (!userMessageId) {
      return res
        .status(400)
        .json({ error: "No user message found before assistant message" });
    }

    // Delete all messages after the user message
    await deleteAIMessagesAfter(convId, userMessageId);

    // Load remaining messages
    const messages = await loadAIMessagesAsCoreMessages(convId);

    // Get conversation for system prompt
    const conversation = await getAIConversation(convId);

    // Get enabled tools
    const tools = getEnabledTools({ enableCodeTools, enableWebTools });

    // Get the model instance
    const modelInstance = getModel(provider, model);

    // Stream the response
    const result = streamText({
      model: modelInstance as any,
      messages: messages as any,
      system: conversation?.system_prompt ?? undefined,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(10),
      onFinish: async ({ text, toolCalls, usage, finishReason }) => {
        await addAIMessage({
          conversation_id: convId,
          role: "assistant",
          content: text,
          tool_invocations: toolCalls?.length ? toolCalls : undefined,
          metadata: { usage, finishReason },
        });

        console.log("Retry completed:", { convId, finishReason, usage });
      },
      onError: ({ error }) => {
        console.error("Stream error:", error);
      },
    });

    // Pipe the stream to the response using AI SDK helpers
    pipeStreamToResponse(result, res, responseFormat);
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
 * Edit a user message and regenerate the response
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
    responseFormat = "ui",
  } = req.body as EditRequestBody;

  const convId = parseInt(conversationId, 10);

  // Check if provider is configured
  if (!isProviderConfigured(provider)) {
    return res.status(400).json({
      error: `Provider '${provider}' is not configured. Please set the required API key.`,
    });
  }

  try {
    // Verify the message exists and is a user message
    const message = await getAIMessageById(messageId, convId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.role !== "user") {
      return res.status(400).json({ error: "Can only edit user messages" });
    }

    // Update the message content
    await updateAIMessageContent(messageId, convId, content);

    // Delete all messages after this user message
    await deleteAIMessagesAfter(convId, messageId);

    // Load remaining messages (including the edited one)
    const messages = await loadAIMessagesAsCoreMessages(convId);

    // Get conversation for system prompt
    const conversation = await getAIConversation(convId);

    // Get enabled tools
    const tools = getEnabledTools({ enableCodeTools, enableWebTools });

    // Get the model instance
    const modelInstance = getModel(provider, model);

    // Stream the response
    const result = streamText({
      model: modelInstance as any,
      messages: messages as any,
      system: conversation?.system_prompt ?? undefined,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(10),
      onFinish: async ({ text, toolCalls, usage, finishReason }) => {
        await addAIMessage({
          conversation_id: convId,
          role: "assistant",
          content: text,
          tool_invocations: toolCalls?.length ? toolCalls : undefined,
          metadata: { usage, finishReason },
        });

        console.log("Edit completed:", { convId, finishReason, usage });
      },
      onError: ({ error }) => {
        console.error("Stream error:", error);
      },
    });

    // Pipe the stream to the response using AI SDK helpers
    pipeStreamToResponse(result, res, responseFormat);
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
