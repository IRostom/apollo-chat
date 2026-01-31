import { Router, Request, Response } from "express";

const router = Router();

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

/**
 * GET /ollama/models
 * List all local Ollama models
 */
router.get("/ollama/models", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!response.ok) {
      throw new Error("Failed to connect to Ollama");
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error listing Ollama models:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list models",
    });
  }
});

/**
 * GET /ollama/ps
 * List running Ollama models
 */
router.get("/ollama/ps", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/ps`);
    if (!response.ok) {
      throw new Error("Failed to connect to Ollama");
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error getting Ollama ps:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get running models",
    });
  }
});

/**
 * POST /ollama/models/pull/:model
 * Pull a model from Ollama registry
 */
router.post("/ollama/models/pull/:model", async (req: Request, res: Response) => {
  const { model } = req.params;
  
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model, stream: false }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to pull model");
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error pulling Ollama model:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to pull model",
    });
  }
});

/**
 * POST /ollama/models/:model
 * Get model details
 */
router.post("/ollama/models/:model", async (req: Request, res: Response) => {
  const { model } = req.params;
  
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to get model details");
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error getting Ollama model details:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get model details",
    });
  }
});

/**
 * DELETE /ollama/models/:model
 * Delete a local model
 */
router.delete("/ollama/models/:model", async (req: Request, res: Response) => {
  const { model } = req.params;
  
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to delete model");
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error deleting Ollama model:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete model",
    });
  }
});

export default router;
