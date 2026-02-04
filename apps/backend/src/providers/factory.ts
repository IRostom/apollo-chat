import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ollama } from "ai-sdk-ollama";

export type Provider = "openai" | "google" | "anthropic" | "ollama";

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

// Ollama uses OLLAMA_HOST from environment (handled by ai-sdk-ollama)

/**
 * Get a model instance for the specified provider and model ID
 * @param provider - The AI provider to use
 * @param modelId - The model identifier (e.g., 'gpt-4o', 'gemini-pro', 'claude-3-opus', 'llama3.2')
 * @returns A language model instance compatible with the AI SDK
 */
export function getModel(provider: Provider, modelId: string) {
  switch (provider) {
    case "openai":
      return openaiProvider(modelId);
    case "google":
      return googleProvider(modelId);
    case "anthropic":
      return anthropicProvider(modelId);
    case "ollama":
      return ollama(modelId);
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
      // Ollama is always available if the server is running
      return true;
    default:
      return false;
  }
}
