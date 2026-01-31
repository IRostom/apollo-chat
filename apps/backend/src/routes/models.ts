import { Router, Request, Response } from "express";
import {
  getConfiguredProviders,
  isProviderConfigured,
  type ProviderName,
} from "../providers";

const router = Router();

/**
 * Model interface for frontend
 */
interface Model {
  id: string;
  name: string;
  provider: ProviderName;
  capabilities: {
    vision: boolean;
    tools: boolean;
    streaming: boolean;
  };
}

interface ModelsByProvider {
  [provider: string]: Model[];
}

/**
 * Hardcoded model lists for cloud providers
 * These are commonly used models - users can still specify any model ID
 */
const OPENAI_MODELS: Model[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    capabilities: { vision: false, tools: true, streaming: true },
  },
];

const ANTHROPIC_MODELS: Model[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    provider: "anthropic",
    capabilities: { vision: true, tools: true, streaming: true },
  },
];

const GOOGLE_MODELS: Model[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    capabilities: { vision: true, tools: true, streaming: true },
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    capabilities: { vision: true, tools: true, streaming: true },
  },
];

/**
 * Ollama API response type for model listing
 */
interface OllamaListResponse {
  models?: Array<{
    name: string;
    details?: {
      families?: string[];
    };
  }>;
}

/**
 * List Ollama models by fetching from Ollama API
 */
async function listOllamaModels(): Promise<Model[]> {
  try {
    const response = await fetch(
      `${process.env.OLLAMA_HOST || "http://localhost:11434"}/api/tags`
    );
    
    if (!response.ok) {
      console.warn("Failed to fetch Ollama models");
      return [];
    }
    
    const data = (await response.json()) as OllamaListResponse;
    const models = data.models || [];
    
    return models.map((model) => ({
      id: model.name,
      name: model.name,
      provider: "ollama" as ProviderName,
      capabilities: {
        vision: model.details?.families?.includes("clip") || false,
        tools: true, // Most modern Ollama models support tools
        streaming: true,
      },
    }));
  } catch (error) {
    console.error("Error listing Ollama models:", error);
    return [];
  }
}

/**
 * GET /models
 * List models from all configured providers
 */
router.get("/models", async (req: Request, res: Response) => {
  try {
    const modelsByProvider: ModelsByProvider = {};
    const configuredProviders = getConfiguredProviders();

    // Always include Ollama if it's accessible
    if (configuredProviders.includes("ollama") || isProviderConfigured("ollama")) {
      const ollamaModels = await listOllamaModels();
      if (ollamaModels.length > 0) {
        modelsByProvider.ollama = ollamaModels;
      }
    }

    // Include other providers if configured
    if (isProviderConfigured("openai")) {
      modelsByProvider.openai = OPENAI_MODELS;
    }

    if (isProviderConfigured("anthropic")) {
      modelsByProvider.anthropic = ANTHROPIC_MODELS;
    }

    if (isProviderConfigured("google")) {
      modelsByProvider.google = GOOGLE_MODELS;
    }

    res.json(modelsByProvider);
  } catch (error) {
    console.error("models/: Error listing models:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /models/:provider
 * List models for a specific provider
 */
router.get("/models/:provider", async (req: Request, res: Response) => {
  const provider = req.params.provider as ProviderName;

  try {
    if (!isProviderConfigured(provider)) {
      return res.status(400).json({
        success: false,
        error: `Provider ${provider} is not configured`,
      });
    }

    let models: Model[] = [];

    switch (provider) {
      case "ollama":
        models = await listOllamaModels();
        break;
      case "openai":
        models = OPENAI_MODELS;
        break;
      case "anthropic":
        models = ANTHROPIC_MODELS;
        break;
      case "google":
        models = GOOGLE_MODELS;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown provider: ${provider}`,
        });
    }

    res.json({ provider, models });
  } catch (error) {
    console.error(`models/${provider}: Error listing models:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
