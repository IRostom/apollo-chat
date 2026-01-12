import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { and, eq, gt } from "drizzle-orm";
import { Message } from "ollama";
import { convertImageIdsToBase64 } from "../utils/imageUtils";

export async function createChat(chat: typeof chatsTable.$inferInsert) {
  const [conv] = await db
    .insert(chatsTable)
    .values(chat)
    .returning({ insertedId: chatsTable.id });
  return conv.insertedId;
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
      return {
        role: r.role,
        content: r.content,
        thinking: r.thinking ?? undefined,
        tool_calls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined,
        tool_name: r.tool_name ?? undefined,
        images: base64Images,
      };
    })
  );
}
