import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import {
  getAllSettings,
  getSetting,
  setSetting,
  deleteSetting,
  isApiKeyConfigured,
  API_KEY_SETTINGS,
} from "../services/settingsService";
import {
  getAvailableProviders,
  isProviderConfigured,
  type ProviderName,
} from "../providers";

const router = Router();

/**
 * GET /settings
 * Get all settings with masked API keys
 */
router.get("/settings", async (req: Request, res: Response) => {
  try {
    const settings = await getAllSettings(true);
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch settings",
    });
  }
});

/**
 * GET /settings/providers
 * Get provider configuration status
 */
router.get("/settings/providers", async (req: Request, res: Response) => {
  try {
    const providers = getAvailableProviders();
    const providerStatus = await Promise.all(
      providers.map(async (provider) => {
        const keyName = getApiKeyNameForProvider(provider);
        const keyStatus = keyName
          ? await isApiKeyConfigured(keyName)
          : { configured: true, source: null }; // Ollama doesn't need a key

        return {
          name: provider,
          configured: isProviderConfigured(provider) || keyStatus.configured,
          keySource: keyStatus.source,
          requiresApiKey: provider !== "ollama",
        };
      })
    );

    res.json({ success: true, providers: providerStatus });
  } catch (error) {
    console.error("Error fetching provider status:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch provider status",
    });
  }
});

/**
 * PUT /settings/:key
 * Update a setting value
 */
router.put(
  "/settings/:key",
  [
    param("key").isString().notEmpty(),
    body("value").isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { key } = req.params;
    const { value } = req.body;

    try {
      await setSetting(key, value);
      res.json({ success: true, message: `Setting ${key} updated` });
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update setting",
      });
    }
  }
);

/**
 * DELETE /settings/:key
 * Delete a setting
 */
router.delete(
  "/settings/:key",
  [param("key").isString().notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { key } = req.params;

    try {
      await deleteSetting(key);
      res.json({ success: true, message: `Setting ${key} deleted` });
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete setting",
      });
    }
  }
);

/**
 * Helper to get API key name for a provider
 */
function getApiKeyNameForProvider(provider: ProviderName): string | null {
  switch (provider) {
    case "openai":
      return API_KEY_SETTINGS.OPENAI_API_KEY;
    case "google":
      return API_KEY_SETTINGS.GOOGLE_API_KEY;
    case "anthropic":
      return API_KEY_SETTINGS.ANTHROPIC_API_KEY;
    case "ollama":
    default:
      return null;
  }
}

export default router;
