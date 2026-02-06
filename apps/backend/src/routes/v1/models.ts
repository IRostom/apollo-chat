import { Router, Request, Response } from "express";
import { isProviderConfigured, type Provider } from "../../providers/factory";
import { MODEL_CATALOG } from "../../config/modelCatalog";
import {
  listOllamaModelsFlat,
  PingOllama,
} from "../../services/ollamaService";

const router = Router();

type ApiProvider = Provider | "ollama-local";

interface ProviderModelResponse {
  name: string;
  label?: string;
  providerId: ApiProvider;
  vision: boolean;
  tools: boolean;
  thinking: boolean;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
  completion?: boolean;
  context_length?: number;
}

interface ProviderResponse {
  id: ApiProvider;
  label: string;
  isAvailable: boolean;
  models: ProviderModelResponse[];
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const providers: ProviderResponse[] = [];

    for (const provider of MODEL_CATALOG.providers) {
      if (!isProviderConfigured(provider.id)) {
        continue;
      }

      providers.push({
        id: provider.id,
        label: provider.label,
        isAvailable: true,
        models: provider.models.map((model) => ({
          name: model.name,
          label: model.label,
          providerId: provider.id,
          vision: model.capabilities.vision,
          tools: model.capabilities.tools,
          thinking: model.capabilities.thinking,
        })),
      });
    }

    const ollamaAvailable = await PingOllama();
    let ollamaModels: ProviderModelResponse[] = [];

    if (ollamaAvailable) {
      try {
        const models = await listOllamaModelsFlat();
        ollamaModels = models.map((model) => ({
          ...model,
          providerId: "ollama-local",
        }));
      } catch (error) {
        console.error("Error listing OLLAMA models:", error);
      }
    }

    providers.push({
      id: "ollama-local",
      label: "Ollama (Local)",
      isAvailable: ollamaAvailable,
      models: ollamaModels,
    });

    res.json({ providers });
  } catch (error) {
    console.error("v1/models: Error listing models:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
