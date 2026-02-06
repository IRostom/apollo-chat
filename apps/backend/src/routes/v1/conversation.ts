import { Router, Request, Response } from "express";
import {
  listAIConversations,
  loadUIMessages,
  deleteAIConversation,
  getAIConversation,
} from "../../services/aiChat";

const router = Router();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/conversations
 * List all v1 (AI SDK) conversations
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const conversations = await listAIConversations();
    res.json(conversations);
  } catch (err) {
    console.error("Error listing v1 conversations:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

/**
 * GET /api/v1/conversations/:id/messages
 * Get messages for a v1 conversation.
 *
 * Messages are stored as UIMessages directly, so no conversion is needed.
 */
router.get("/:id/messages", async (req: Request, res: Response) => {
  const convId = parseInt(req.params.id, 10);
  if (isNaN(convId)) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  try {
    const conversation = await getAIConversation(convId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Load UIMessages directly from DB — no ModelMessage→UIMessage conversion
    const messages = await loadUIMessages(convId);
    res.json(messages);
  } catch (err) {
    console.error("Error fetching v1 conversation messages:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

/**
 * DELETE /api/v1/conversations/:id
 * Delete a v1 conversation and all its messages
 */
router.delete("/:id", async (req: Request, res: Response) => {
  const convId = parseInt(req.params.id, 10);
  if (isNaN(convId)) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  try {
    const conversation = await getAIConversation(convId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await deleteAIConversation(convId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting v1 conversation:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

export default router;
