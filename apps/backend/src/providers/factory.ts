import { createOpenAI, openai } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama, ollama } from "ai-sdk-ollama";

export type Provider =
  | "openai"
  | "google"
  | "anthropic"
  | "ollama"
  | "ollama-cloud";

// Create provider instances with API keys from environment variables
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ollamaCloudProvider = createOllama({
  baseURL: "https://ollama.com",
  apiKey: process.env.OLLAMA_API_KEY,
});

// Ollama uses OLLAMA_HOST from environment (handled by ai-sdk-ollama)

export interface ModelOptions {
  /** Enable thinking/reasoning output (Ollama models that support it) */
  think?: boolean;
}

/**
 * Get a model instance for the specified provider and model ID
 * @param provider - The AI provider to use
 * @param modelId - The model identifier (e.g., 'gpt-4o', 'gemini-pro', 'claude-3-opus', 'llama3.2')
 * @param options - Optional provider-specific settings (e.g. thinking)
 * @returns A language model instance compatible with the AI SDK
 */
export function getModel(provider: Provider, modelId: string, options?: ModelOptions) {
  switch (provider) {
    case "openai":
      return openai(modelId);
    case "google":
      return googleProvider(modelId);
    case "anthropic":
      return anthropicProvider(modelId);
    case "ollama":
      return ollama(modelId, {
        ...(options?.think !== undefined && { think: options.think }),
      });
    case "ollama-cloud":
      return ollamaCloudProvider(modelId, {
        ...(options?.think !== undefined && { think: options.think }),
      });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Check if a provider is properly configured with API keys
 * @param provider - The provider to check
 * @returns true if the provider is configured
 */
export function isProviderConfigured(provider: Provider): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "google":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "ollama":
      // Availability is validated at runtime via PingOllama(); OLLAMA_HOST defaults to localhost:11434
      return true;
    case "ollama-cloud":
      return !!process.env.OLLAMA_API_KEY;
    default:
      return false;
  }
}
