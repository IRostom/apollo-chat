import { Router, Request, Response } from "express";
import { listOllamaModelsByFamily } from "../services/ollamaService";

const router = Router();

// TODO: handle different providers
router.get("/models", async (req: Request, res: Response) => {
  try {
    const models = await listOllamaModelsByFamily();
    res.json(models);
  } catch (error) {
    console.error("models/: Error listing models:", error);
    res.status(500).json({ error: "Failed to list models: " + error });
  }
});

export default router;
