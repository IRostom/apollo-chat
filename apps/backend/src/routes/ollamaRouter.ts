import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { eq } from "drizzle-orm";
import ollama from "ollama";
import { body } from "express-validator";

const router = Router();

router.get("/ollama/models", async (req: Request, res: Response) => {
  const models = await ollama.list();
  res.json(models);
});

router.get("/ollama/ps", async (req: Request, res: Response) => {
  const ps = await ollama.ps();
  res.json(ps);
});

router.post("/ollama/models/:model", async (req: Request, res: Response) => {
  const { model } = req.params;
  const response = await ollama.pull({ model, stream: false });
  res.json(response);
});

router.delete("/ollama/models/:model", async (req: Request, res: Response) => {
  const { model } = req.params;
  const response = await ollama.delete({ model });
  res.json(response);
});

export default router;
