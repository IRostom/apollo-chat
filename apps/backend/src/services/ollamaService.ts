import { ollamaClient } from "../ollama/client";

export interface Model {
  name: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
  vision: boolean;
  thinking: boolean;
  tools: boolean;
  completion: boolean;
  context_length: number;
}

export interface ModelsByFamily {
  [key: string]: Model[];
}

async function fetchAllModels(): Promise<Model[]> {
  const response = await ollamaClient.list();
  const modelNames = response.models.map((model) => model.name);
  return Promise.all(
    modelNames.map(async (name) => {
      const detail = await ollamaClient.show({ model: name });
      const family = detail.details.family;
      const contextLength =
        (detail.model_info as unknown as Record<string, number>)?.[
          `${family}.context_length`
        ] ?? 0;

      return {
        name,
        family,
        families: detail.details.families,
        parameter_size: detail.details.parameter_size,
        quantization_level: detail.details.quantization_level,
        vision: detail.capabilities.includes("vision"),
        thinking: detail.capabilities.includes("thinking"),
        tools: detail.capabilities.includes("tools"),
        completion: detail.capabilities.includes("completion"),
        context_length: contextLength,
      };
    }),
  );
}

export async function listOllamaModelsByFamily(): Promise<ModelsByFamily> {
  const isOllamaRunning = await PingOllama();
  if (!isOllamaRunning) {
    throw new Error(
      "OLLAMA is not running or we are not able to connect to it",
    );
  }
  try {
    const models = await fetchAllModels();
    const modelsByFamily: ModelsByFamily = {};
    models.forEach((model) => {
      modelsByFamily[model.family] = [
        ...(modelsByFamily[model.family] || []),
        model,
      ];
    });
    return modelsByFamily;
  } catch (error: unknown) {
    console.error("Error listing OLLAMA models by family:", error);
    throw new Error(
      "Failed to list models: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
  }
}

export async function listOllamaModelsFlat(): Promise<Model[]> {
  const isOllamaRunning = await PingOllama();
  if (!isOllamaRunning) {
    throw new Error(
      "OLLAMA is not running or we are not able to connect to it",
    );
  }
  try {
    return await fetchAllModels();
  } catch (error: unknown) {
    console.error("Error listing OLLAMA models:", error);
    throw new Error(
      "Failed to list models: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
  }
}

export async function PingOllama(): Promise<boolean> {
  try {
    await ollamaClient.version();
    return true;
  } catch (error) {
    console.error("Error pinging OLLAMA:", error);
    return false;
  }
}
