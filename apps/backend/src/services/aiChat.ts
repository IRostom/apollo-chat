import { createIdGenerator } from "ai";
import { db } from "../db/client";
import { aiConversationsTable, aiMessagesTable } from "../db/schema";
import { and, eq, gte, desc, inArray } from "drizzle-orm";
import type { Provider } from "../providers/factory";
import type { UIMessage } from "ai";

const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 });

// ============================================================================
// JSON Serialization Helpers
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

// ============================================================================
// Conversation Operations
// ============================================================================

/**
 * Create a new AI conversation.
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
 * Get a conversation by ID.
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
 * List all AI conversations, ordered by most recent.
 */
export async function listAIConversations(): Promise<AIConversation[]> {
  return db
    .select()
    .from(aiConversationsTable)
    .orderBy(desc(aiConversationsTable.updated_at));
}

/**
 * Branch a conversation at an assistant message.
 * Creates a new conversation with messages up to and including the specified message.
 * Returns the new conversation ID.
 */
export async function branchConversation(
  conversationId: number,
  messageId: string
): Promise<number> {
  const conversation = await getAIConversation(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const messages = await loadUIMessages(conversationId);
  const branchIndex = messages.findIndex((m) => m.id === messageId);
  if (branchIndex === -1) {
    throw new Error("Message not found");
  }
  if (messages[branchIndex].role !== "assistant") {
    throw new Error("Can only branch from an assistant message");
  }

  const messagesToCopy = messages.slice(0, branchIndex + 1);
  if (messagesToCopy.length === 0) {
    throw new Error("No messages to branch");
  }

  const title =
    messagesToCopy
      .filter((m) => m.role === "user")
      .flatMap((m) =>
        (m.parts ?? [])
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
      )
      .join(" ")
      .slice(0, 50) || "Branched chat";

  const newConvId = await createAIConversation({
    title,
    provider: conversation.provider as Provider,
    model: conversation.model,
    system_prompt: conversation.system_prompt ?? undefined,
  });

  // Clone messages with new IDs to avoid primary key conflicts (ai_messages.id is globally unique)
  const messagesWithNewIds: UIMessage[] = messagesToCopy.map((msg) => ({
    ...msg,
    id: generateMessageId(),
  }));

  await saveUIMessages(newConvId, messagesWithNewIds);
  return newConvId;
}

/**
 * Delete a conversation and all its messages.
 */
export async function deleteAIConversation(id: number): Promise<void> {
  await db
    .delete(aiMessagesTable)
    .where(eq(aiMessagesTable.conversation_id, id));
  await db
    .delete(aiConversationsTable)
    .where(eq(aiConversationsTable.id, id));
}

// ============================================================================
// UIMessage Persistence
//
// Per the AI SDK docs: "We recommend storing the messages in the useChat
// message format" (UIMessage), not ModelMessage.
//
// Each UIMessage is stored as one row in ai_messages.
// ============================================================================

/**
 * Save a single UIMessage to the database.
 */
export async function saveUIMessage(
  conversationId: number,
  message: UIMessage,
  metadata?: unknown
): Promise<void> {
  if (!message.id) {
    throw new Error("UIMessage.id is required for persistence");
  }
  await db.insert(aiMessagesTable).values({
    id: message.id,
    conversation_id: conversationId,
    role: message.role,
    message: JSON.stringify(message),
    metadata: serializeJSON(metadata),
  });
}

/**
 * Save multiple UIMessages to the database.
 * Metadata is attached to the last message.
 */
export async function saveUIMessages(
  conversationId: number,
  messages: UIMessage[],
  metadata?: unknown
): Promise<void> {
  if (messages.length === 0) return;

  const rows = messages.map((msg, i) => ({
    id: msg.id,
    conversation_id: conversationId,
    role: msg.role,
    message: JSON.stringify(msg),
    metadata:
      i === messages.length - 1 ? serializeJSON(metadata) : null,
  }));

  if (rows.some((row) => !row.id)) {
    throw new Error("UIMessage.id is required for persistence");
  }

  await db.insert(aiMessagesTable).values(rows);
}

/**
 * Load all UIMessages for a conversation, ordered by creation.
 */
export async function loadUIMessages(
  conversationId: number
): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversation_id, conversationId))
    .orderBy(aiMessagesTable.created_at);

  return rows
    .map((row) => parseJSON<UIMessage>(row.message))
    .filter((msg): msg is UIMessage => {
      if (!msg) return false;
      // Validate basic UIMessage structure (skip old ModelMessage rows)
      if (!Array.isArray(msg.parts)) {
        console.warn(
          "Skipping non-UIMessage row (missing parts array)"
        );
        return false;
      }
      return true;
    });
}

/**
 * Get raw message rows with their DB IDs.
 * Useful for retry/edit operations that need to delete/update specific rows.
 */
export async function getMessageRows(
  conversationId: number
): Promise<{ messageId: string; createdAt: number; uiMessage: UIMessage }[]> {
  const rows = await db
    .select()
    .from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversation_id, conversationId))
    .orderBy(aiMessagesTable.created_at);

  return rows
    .map((row) => ({
      messageId: row.id,
      createdAt: row.created_at,
      uiMessage: parseJSON<UIMessage>(row.message)!,
    }))
    .filter((r) => r.uiMessage != null && Array.isArray(r.uiMessage.parts));
}

/**
 * Delete all message rows with created_at >= the given timestamp.
 */
export async function deleteMessageRowsFromTimestamp(
  conversationId: number,
  fromTimestamp: number
): Promise<void> {
  await db
    .delete(aiMessagesTable)
    .where(
      and(
        eq(aiMessagesTable.conversation_id, conversationId),
        gte(aiMessagesTable.created_at, fromTimestamp)
      )
    );
}

/**
 * Delete assistant message rows with created_at >= the given timestamp.
 */
export async function deleteAssistantMessageRowsFromTimestamp(
  conversationId: number,
  fromTimestamp: number
): Promise<void> {
  await db
    .delete(aiMessagesTable)
    .where(
      and(
        eq(aiMessagesTable.conversation_id, conversationId),
        eq(aiMessagesTable.role, "assistant"),
        gte(aiMessagesTable.created_at, fromTimestamp)
      )
    );
}

/**
 * Delete message rows by their message IDs.
 */
export async function deleteMessageRowsByIds(
  conversationId: number,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  await db
    .delete(aiMessagesTable)
    .where(
      and(
        eq(aiMessagesTable.conversation_id, conversationId),
        inArray(aiMessagesTable.id, messageIds)
      )
    );
}

/**
 * Update a single message row's content.
 */
export async function updateMessageRow(
  messageId: string,
  uiMessage: UIMessage
): Promise<void> {
  await db
    .update(aiMessagesTable)
    .set({
      message: JSON.stringify(uiMessage),
      role: uiMessage.role,
    })
    .where(eq(aiMessagesTable.id, messageId));
}
