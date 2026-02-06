import { db } from "../db/client";
import { aiConversationsTable, aiMessagesTable } from "../db/schema";
import { and, eq, gt, lte, desc } from "drizzle-orm";
import type { Provider } from "../providers/factory";
import type { ModelMessage } from "ai";

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
  message: string; // JSON-serialized ModelMessage
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
 * Add a single ModelMessage to a conversation.
 * The message is JSON-serialized and the role is extracted for query convenience.
 */
export async function addAIMessage(
  conversationId: number,
  message: ModelMessage,
  metadata?: unknown
): Promise<number> {
  const [msg] = await db
    .insert(aiMessagesTable)
    .values({
      conversation_id: conversationId,
      role: message.role,
      message: JSON.stringify(message),
      metadata: serializeJSON(metadata),
    })
    .returning({ insertedId: aiMessagesTable.id });
  return msg.insertedId;
}

/**
 * Add multiple ModelMessages to a conversation (e.g. from response.messages).
 * Returns the IDs of the inserted messages.
 */
export async function addAIMessages(
  conversationId: number,
  messages: ModelMessage[],
  metadata?: unknown
): Promise<number[]> {
  if (messages.length === 0) return [];

  const rows = messages.map((message) => ({
    conversation_id: conversationId,
    role: message.role,
    message: JSON.stringify(message),
    metadata: null as string | null,
  }));

  // Attach metadata to the last message
  if (metadata && rows.length > 0) {
    rows[rows.length - 1].metadata = serializeJSON(metadata);
  }

  const result = await db
    .insert(aiMessagesTable)
    .values(rows)
    .returning({ insertedId: aiMessagesTable.id });

  return result.map((r) => r.insertedId);
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
 * Load messages and return as ModelMessage[] for direct use with the AI SDK.
 * Simply parses the JSON-serialized message column.
 */
export async function loadAIMessagesAsModelMessages(
  conversationId: number
): Promise<ModelMessage[]> {
  const rows = await getAIMessages(conversationId);
  return rows
    .map((row) => parseJSON<ModelMessage>(row.message))
    .filter((msg): msg is ModelMessage => msg !== undefined);
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
 * Update message content (for editing user messages).
 * Parses the stored ModelMessage JSON, updates the content, and re-serializes.
 */
export async function updateAIMessageContent(
  messageId: number,
  conversationId: number,
  content: string
): Promise<void> {
  const existing = await getAIMessageById(messageId, conversationId);
  if (!existing) return;

  const message = parseJSON<ModelMessage>(existing.message);
  if (!message) return;

  // Update the content field in the ModelMessage
  const updated: ModelMessage = { ...message, content } as ModelMessage;

  await db
    .update(aiMessagesTable)
    .set({ message: JSON.stringify(updated) })
    .where(
      and(
        eq(aiMessagesTable.id, messageId),
        eq(aiMessagesTable.conversation_id, conversationId)
      )
    );
}

/**
 * Update metadata for a specific message (e.g. to attach usage/finishReason).
 */
export async function updateMessageMetadata(
  messageId: number,
  conversationId: number,
  metadata: unknown
): Promise<void> {
  await db
    .update(aiMessagesTable)
    .set({ metadata: serializeJSON(metadata) })
    .where(
      and(
        eq(aiMessagesTable.id, messageId),
        eq(aiMessagesTable.conversation_id, conversationId)
      )
    );
}
