import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { eq } from "drizzle-orm";

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
