import { Router, Request, Response } from "express";
import { listOllamaModelsByFamily } from "../services/ollamaService";

const router = Router();

// TODO: handle different providers
router.get("/models", async (req: Request, res: Response) => {
  const models = await listOllamaModelsByFamily();
  res.json(models);
});

export default router;
