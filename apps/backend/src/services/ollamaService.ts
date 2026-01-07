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

export async function listOllamaModelsByFamily(): Promise<ModelsByFamily> {
  const isOllamaRunning = await PingOllama();
  if (!isOllamaRunning) {
    throw new Error(
      "OLLAMA is not running or we are not able to connect to it"
    );
  }
  try {
    const response = await ollamaClient.list();
    const modelNames = response.models.map((model) => model.name);
    const models = await Promise.all(
      modelNames.map(async (name) => {
        const response = await ollamaClient.show({ model: name });
        const family = response.details.family;
        let contextLength = 0;

        contextLength =
          (response.model_info as unknown as Record<string, number>)?.[
            `${family}.context_length`
          ] ?? undefined;

        return {
          name: name,
          family: family,
          families: response.details.families,
          parameter_size: response.details.parameter_size,
          quantization_level: response.details.quantization_level,
          vision: response.capabilities.includes("vision"),
          thinking: response.capabilities.includes("thinking"),
          tools: response.capabilities.includes("tools"),
          completion: response.capabilities.includes("completion"),
          context_length: contextLength,
        };
      })
    );
    const modelsByFamily: ModelsByFamily = {};
    models.forEach((model) => {
      modelsByFamily[model.family] = [
        ...(modelsByFamily[model.family] || []),
        model,
      ];
    });

    return modelsByFamily;
  } catch (error: any) {
    console.error("Error listing OLLAMA models by family:", error);
    throw new Error(
      "Failed to list models: " +
        (error instanceof Error ? error.message : "Unknown error")
    );
  }
}

export async function PingOllama(): Promise<any> {
  try {
    await ollamaClient.version();
    return true;
  } catch (error: any) {
    console.error("Error pinging OLLAMA:", error);
    return false;
  }
}
