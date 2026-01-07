import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { fileService } from "../db/fileService";

const router = Router();

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const conversations = await db
      .select()
      .from(chatsTable)
      .orderBy(desc(chatsTable.updated_at));
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error" + err,
    });
  }
});

router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, +id));
    const mapped = await Promise.all(
      messages.map(async (m) => {
        const imageIds = m.images ? m.images.split(",").filter(Boolean) : [];
        let images;
        if (imageIds.length) {
          images = await Promise.all(
            imageIds.map(async (i) => {
              const file = await fileService.getFileById(+i);
              return file?.path;
            })
          );
        }
        return {
          ...m,
          images,
        };
      })
    );
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error" + err,
    });
  }
});

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db
      .delete(messagesTable)
      .where(eq(messagesTable.conversation_id, +id));
    await db.delete(chatsTable).where(eq(chatsTable.id, +id));
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error" + err,
    });
  }
});

export default router;
