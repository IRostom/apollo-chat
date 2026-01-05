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
}

export interface ModelsByFamily {
  [key: string]: Model[];
}

export async function listOllamaModelsByFamily(): Promise<ModelsByFamily> {
  const response = await ollamaClient.list();
  const modelNames = response.models.map((model) => model.name);
  const models = await Promise.all(
    modelNames.map(async (name) => {
      const response = await ollamaClient.show({ model: name });
      return {
        name: name,
        family: response.details.family,
        families: response.details.families,
        parameter_size: response.details.parameter_size,
        quantization_level: response.details.quantization_level,
        vision: response.capabilities.includes("vision"),
        thinking: response.capabilities.includes("thinking"),
        tools: response.capabilities.includes("tools"),
        completion: response.capabilities.includes("completion"),
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
}
