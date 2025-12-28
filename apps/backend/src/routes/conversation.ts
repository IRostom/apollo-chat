import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/conversations", async (req: Request, res: Response) => {
  const conversations = await db
    .select()
    .from(chatsTable)
    .orderBy(desc(chatsTable.updated_at));
  res.json(conversations);
});

router.get("/conversations/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversation_id, +id));
  res.json(messages);
});

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await db.delete(messagesTable).where(eq(messagesTable.conversation_id, +id));
  await db.delete(chatsTable).where(eq(chatsTable.id, +id));
  res.sendStatus(204);
});

export default router;
