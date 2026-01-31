/**
 * Streaming chat response utility using Vercel AI SDK
 * Provides unified streaming across all providers (Ollama, OpenAI, Google, Anthropic)
 */

import { Response } from "express";
import { streamText } from "ai";
import { getModel, type ProviderName } from "../providers";
import { getTools } from "../tools";
import { addMessageToChat } from "../services/chat";

/**
 * AI SDK message format - supports both content string and parts array
 */
export interface ChatMessage {
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
 * Extract text content from a message
 * Handles both direct content string and parts array format
 */
function extractContent(message: ChatMessage): string {
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

export interface StreamChatOptions {
  res: Response;
  conversationId: number;
  provider: ProviderName;
  model: string;
  messages: ChatMessage[];
  webTools?: boolean;
}

/**
 * Stream a chat response using AI SDK's streamText
 * Works with all supported providers (Ollama, OpenAI, Google, Anthropic)
 */
export async function streamChatResponse(
  options: StreamChatOptions
): Promise<void> {
  const { res, conversationId, provider, model, messages, webTools } = options;

  let isAborted = false;

  // Handle client disconnection
  const handleClose = () => {
    if (isAborted) return;
    isAborted = true;
    console.log("Client disconnected, stream will be aborted...");
  };

  res.on("close", handleClose);

  try {
    const modelInstance = getModel(provider, model);
    const tools = getTools(webTools);

    // Convert messages to the format expected by AI SDK
    const formattedMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: extractContent(msg),
    }));

    const result = streamText({
      model: modelInstance,
      messages: formattedMessages,
      tools,
      onFinish: async ({ text, usage, providerMetadata, toolCalls }) => {
        if (isAborted) {
          console.log("Stream was aborted, saving partial response...");
        }

        // Build metadata from usage and provider-specific data
        const metadata: Record<string, unknown> = {
          done: !isAborted,
          done_reason: isAborted ? "user_stopped" : "complete",
        };

        // Add usage info if available
        if (usage) {
          const usageData = usage as Record<string, unknown>;
          metadata.promptTokens = usageData.promptTokens;
          metadata.completionTokens = usageData.completionTokens;
          metadata.totalTokens = usageData.totalTokens;
        }

        // Include Ollama-specific metrics if available
        if (provider === "ollama" && providerMetadata?.ollama) {
          const ollamaMetrics = providerMetadata.ollama as Record<string, unknown>;
          metadata.eval_count = ollamaMetrics.eval_count;
          metadata.eval_duration = ollamaMetrics.eval_duration;
          metadata.load_duration = ollamaMetrics.load_duration;
          metadata.prompt_eval_count = ollamaMetrics.prompt_eval_count;
          metadata.prompt_eval_duration = ollamaMetrics.prompt_eval_duration;
          metadata.model = model;

          // Calculate tokens per second for Ollama
          if (
            typeof ollamaMetrics.eval_count === "number" &&
            typeof ollamaMetrics.eval_duration === "number" &&
            ollamaMetrics.eval_duration > 0
          ) {
            metadata.tokensPerSecond =
              ollamaMetrics.eval_count /
              (ollamaMetrics.eval_duration / 1_000_000_000);
          }
        }

        // Persist the assistant message
        await addMessageToChat({
          conversation_id: conversationId,
          content: text || "",
          role: "assistant",
          tool_calls: toolCalls ? JSON.stringify(toolCalls) : undefined,
          metadata: JSON.stringify(metadata),
        });

        console.log("Assistant message persisted to database");
      },
    });

    // Pipe the AI SDK stream response to the Express response
    result.pipeTextStreamToResponse(res);
  } catch (err) {
    console.error("Stream error:", err);

    // If headers haven't been sent, send error response
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  } finally {
    res.off("close", handleClose);
  }
}

/**
 * Process messages for retry - removes messages after the specified message ID
 */
export function processMessagesForRetry(
  messages: ChatMessage[],
  messageId: string
): ChatMessage[] {
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) {
    return messages;
  }
  // Return messages up to but not including the message to retry from
  return messages.slice(0, index);
}

/**
 * Process messages for edit - updates content and removes subsequent messages
 */
export function processMessagesForEdit(
  messages: ChatMessage[],
  messageId: string,
  newContent: string
): ChatMessage[] {
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) {
    return messages;
  }

  // Keep messages up to and including the edited message
  const processedMessages = messages.slice(0, index + 1);

  // Update the content of the edited message
  processedMessages[index] = {
    ...processedMessages[index],
    content: newContent,
  };

  return processedMessages;
}
