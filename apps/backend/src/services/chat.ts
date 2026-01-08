import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { and, eq, gt } from "drizzle-orm";

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

export async function getMessageById(id: number) {
  const [message] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, id));
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
