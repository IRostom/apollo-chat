import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { fileService } from "../db/fileService";

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
  const mapped = await Promise.all(
    messages.map(async (m) => {
      const imageIds = m.images?.split(",");
      let images;
      if (imageIds?.length) {
        images = await Promise.all(
          imageIds.map(async (i) => {
            const file = await fileService.getFileById(+i);
            return file?.path;
          })
        );
      }
      // When `m.images` is an empty string (stored from an empty image array being sent to the backend), splitting it produces `[""]` with length 1, causing the code to attempt fetching a file with ID 0 via `fileService.getFileById(+i)` where `i` is an empty string. The condition should validate that the split result contains actual IDs before processing.
      return {
        ...m,
        images,
      };
    })
  );
  res.json(mapped);
});

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await db.delete(messagesTable).where(eq(messagesTable.conversation_id, +id));
  await db.delete(chatsTable).where(eq(chatsTable.id, +id));
  res.sendStatus(204);
});

export default router;
