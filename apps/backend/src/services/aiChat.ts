import { db } from "../db/client";
import { aiConversationsTable, aiMessagesTable } from "../db/schema";
import { and, eq, gt, lte, desc } from "drizzle-orm";
import type { Provider } from "../providers/factory";

// AI SDK message types - using the types from the SDK
type MessageRole = "user" | "assistant" | "tool" | "system";

interface TextPart {
  type: "text";
  text: string;
}

interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: unknown;
}

interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: unknown;
}

// AI SDK compatible message type
export interface AISDKMessage {
  role: MessageRole;
  content: string | Array<TextPart | ToolCallPart | ToolResultPart>;
}

// ============================================================================
// JSON Serialization Helpers for SQLite
// ============================================================================

function serializeJSON(obj: unknown): string | null {
  if (obj === undefined || obj === null) return null;
  return JSON.stringify(obj);
}

function parseJSON<T>(str: string | null | undefined): T | undefined {
  if (!str) return undefined;
  try {
    return JSON.parse(str) as T;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface CreateAIConversationInput {
  title: string;
  provider: Provider;
  model: string;
  system_prompt?: string;
}

export interface AddAIMessageInput {
  conversation_id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  parts?: unknown;
  tool_invocations?: unknown;
  reasoning?: string;
  attachments?: unknown;
  metadata?: unknown;
}

export interface AIConversation {
  id: number;
  title: string;
  provider: string;
  model: string;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  parts: string | null;
  tool_invocations: string | null;
  reasoning: string | null;
  attachments: string | null;
  metadata: string | null;
  created_at: string;
}

// ============================================================================
// Conversation Operations
// ============================================================================

/**
 * Create a new AI conversation
 */
export async function createAIConversation(
  input: CreateAIConversationInput
): Promise<number> {
  const [conv] = await db
    .insert(aiConversationsTable)
    .values({
      title: input.title,
      provider: input.provider,
      model: input.model,
      system_prompt: input.system_prompt ?? null,
    })
    .returning({ insertedId: aiConversationsTable.id });
  return conv.insertedId;
}

/**
 * Get a conversation by ID
 */
export async function getAIConversation(
  id: number
): Promise<AIConversation | undefined> {
  const [conv] = await db
    .select()
    .from(aiConversationsTable)
    .where(eq(aiConversationsTable.id, id));
  return conv;
}

/**
 * List all AI conversations, ordered by most recent
 */
export async function listAIConversations(): Promise<AIConversation[]> {
  return db
    .select()
    .from(aiConversationsTable)
    .orderBy(desc(aiConversationsTable.updated_at));
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteAIConversation(id: number): Promise<void> {
  await db.delete(aiMessagesTable).where(eq(aiMessagesTable.conversation_id, id));
  await db.delete(aiConversationsTable).where(eq(aiConversationsTable.id, id));
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Add a message to a conversation
 * Handles JSON serialization for complex fields
 */
export async function addAIMessage(input: AddAIMessageInput): Promise<number> {
  const [msg] = await db
    .insert(aiMessagesTable)
    .values({
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      parts: serializeJSON(input.parts),
      tool_invocations: serializeJSON(input.tool_invocations),
      reasoning: input.reasoning ?? null,
      attachments: serializeJSON(input.attachments),
      metadata: serializeJSON(input.metadata),
    })
    .returning({ insertedId: aiMessagesTable.id });
  return msg.insertedId;
}

/**
 * Get a message by ID
 */
export async function getAIMessageById(
  id: number,
  conversationId: number
): Promise<AIMessage | undefined> {
  const [msg] = await db
    .select()
    .from(aiMessagesTable)
    .where(
      and(
        eq(aiMessagesTable.id, id),
        eq(aiMessagesTable.conversation_id, conversationId)
      )
    );
  return msg;
}

/**
 * Get all messages for a conversation
 */
export async function getAIMessages(conversationId: number): Promise<AIMessage[]> {
  return db
    .select()
    .from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversation_id, conversationId));
}

/**
 * Load messages and convert to AI SDK message format
 */
export async function loadAIMessagesAsCoreMessages(
  conversationId: number
): Promise<AISDKMessage[]> {
  const rows = await getAIMessages(conversationId);

  return rows.map((row): AISDKMessage => {
    const toolInvocations = parseJSON<unknown[]>(row.tool_invocations);

    // Map to AISDKMessage based on role
    if (row.role === "user") {
      return {
        role: "user",
        content: row.content,
      };
    } else if (row.role === "assistant") {
      // Assistant messages may include tool calls
      if (
        toolInvocations &&
        Array.isArray(toolInvocations) &&
        toolInvocations.length > 0
      ) {
        return {
          role: "assistant",
          content: [
            ...(row.content
              ? [{ type: "text" as const, text: row.content }]
              : []),
            ...toolInvocations.map((invocation: any) => ({
              type: "tool-call" as const,
              toolCallId: invocation.toolCallId,
              toolName: invocation.toolName,
              args: invocation.args,
            })),
          ],
        };
      }
      return {
        role: "assistant",
        content: row.content,
      };
    } else if (row.role === "tool") {
      // Tool result messages
      const invocation = toolInvocations?.[0] as any;
      return {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: invocation?.toolCallId ?? "unknown",
            toolName: invocation?.toolName ?? "unknown",
            result: row.content,
          },
        ],
      };
    }

    // Fallback to user message
    return {
      role: "user",
      content: row.content,
    };
  });
}

/**
 * Get messages up to and including a specific message ID
 */
export async function getAIMessagesUpTo(
  conversationId: number,
  messageId: number
): Promise<AIMessage[]> {
  return db
    .select()
    .from(aiMessagesTable)
    .where(
      and(
        eq(aiMessagesTable.conversation_id, conversationId),
        lte(aiMessagesTable.id, messageId)
      )
    );
}

/**
 * Delete all messages after a specific message ID
 */
export async function deleteAIMessagesAfter(
  conversationId: number,
  messageId: number
): Promise<void> {
  await db
    .delete(aiMessagesTable)
    .where(
      and(
        eq(aiMessagesTable.conversation_id, conversationId),
        gt(aiMessagesTable.id, messageId)
      )
    );
}

/**
 * Update message content
 */
export async function updateAIMessageContent(
  messageId: number,
  conversationId: number,
  content: string
): Promise<void> {
  await db
    .update(aiMessagesTable)
    .set({ content })
    .where(
      and(
        eq(aiMessagesTable.id, messageId),
        eq(aiMessagesTable.conversation_id, conversationId)
      )
    );
}
