import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { and, eq, gt, lte } from "drizzle-orm";
import { Message } from "ollama";
import { convertImageIdsToBase64 } from "../utils/imageUtils";

export async function createChat(chat: typeof chatsTable.$inferInsert) {
  const [conv] = await db
    .insert(chatsTable)
    .values(chat)
    .returning({ insertedId: chatsTable.id });
  return conv.insertedId;
}

export async function getChatById(id: number) {
  const [chat] = await db
    .select()
    .from(chatsTable)
    .where(eq(chatsTable.id, id));
  return chat;
}

export async function getChatHistory(id: number) {
  return db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversation_id, id));
}

export async function addMessageToChat(
  message: typeof messagesTable.$inferInsert
) {
  return db.insert(messagesTable).values(message);
}

export async function getMessageById(id: number, conversationId: number) {
  const [message] = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.id, id),
        eq(messagesTable.conversation_id, conversationId)
      )
    );
  return message;
}

export async function deleteMessagesAfterUserMessage(
  conversationId: number,
  userMessageId: number
) {
  return db
    .delete(messagesTable)
    .where(
      and(
        eq(messagesTable.conversation_id, conversationId),
        gt(messagesTable.id, userMessageId)
      )
    );
}

export async function updateMessageContent(
  messageId: number,
  conversationId: number,
  content: string
) {
  return db
    .update(messagesTable)
    .set({ content })
    .where(
      and(
        eq(messagesTable.id, messageId),
        eq(messagesTable.conversation_id, conversationId)
      )
    );
}

/**
 * Get messages up to and including a specific message ID
 */
export async function getMessagesUpTo(
  conversationId: number,
  messageId: number
) {
  return db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.conversation_id, conversationId),
        lte(messagesTable.id, messageId)
      )
    );
}

/**
 * Copy messages from one conversation to another
 * Creates new message records with the new conversation ID
 */
export async function copyMessagesToConversation(
  messages: Array<{
    content: string;
    thinking: string | null;
    tool_calls: string | null;
    tool_name: string | null;
    role: string;
    images: string | null;
    metadata: string | null;
  }>,
  newConversationId: number
) {
  if (messages.length === 0) return;

  const messagesToInsert = messages.map((m) => ({
    content: m.content,
    thinking: m.thinking,
    tool_calls: m.tool_calls,
    tool_name: m.tool_name,
    role: m.role,
    images: m.images,
    metadata: m.metadata,
    conversation_id: newConversationId,
  }));

  return db.insert(messagesTable).values(messagesToInsert);
}

/**
 * Load chat history from database and convert to Ollama Message format
 */
export async function loadChatHistory(
  conversationId: number
): Promise<Message[]> {
  const results = await getChatHistory(conversationId);
  return Promise.all(
    results.map(async (r) => {
      let base64Images;
      if (r.images && r.images.trim()) {
        try {
          const ids = r.images
            .trim()
            .split(",")
            .filter((id) => id.trim());
          if (ids.length > 0) {
            base64Images = await convertImageIdsToBase64(ids);
          }
        } catch (error) {
          console.error("Error processing images:", error);
        }
      }

      let toolCalls;
      if (r.tool_calls) {
        try {
          toolCalls = JSON.parse(r.tool_calls);
        } catch (error) {
          console.error("Error parsing tool_calls:", error);
        }
      }

      return {
        role: r.role,
        content: r.content,
        thinking: r.thinking ?? undefined,
        tool_calls: toolCalls,
        tool_name: r.tool_name ?? undefined,
        images: base64Images,
      };
    })
  );
}
