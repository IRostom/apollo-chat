import { Router, Request, Response } from "express";
import {
  listAIConversations,
  loadUIMessages,
  deleteAIConversation,
  getAIConversation,
  branchConversation,
} from "../../services/aiChat";
import { hydrateUIMessagesWithPresignedUrls } from "../../services/filePartService";

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
    const hydratedMessages = await hydrateUIMessagesWithPresignedUrls(messages);
    res.json(hydratedMessages);
  } catch (err) {
    console.error("Error fetching v1 conversation messages:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

/**
 * POST /api/v1/conversations/:id/branch
 * Branch the conversation at an assistant message. Creates a new conversation
 * with messages up to and including the specified message.
 * Body: { messageId: string }
 */
router.post("/:id/branch", async (req: Request, res: Response) => {
  const convId = parseInt(req.params.id, 10);
  if (isNaN(convId)) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  const { messageId } = req.body as { messageId?: string };
  if (!messageId || typeof messageId !== "string") {
    return res.status(400).json({ error: "messageId is required" });
  }

  try {
    const newConvId = await branchConversation(convId, messageId);
    res.status(201).json({ id: newConvId });
  } catch (err) {
    console.error("Error branching conversation:", err);
    const msg = err instanceof Error ? err.message : "Failed to branch";
    const status = msg.includes("not found") ? 404 : 400;
    res.status(status).json({ error: msg });
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
