import { ollama } from "ai-sdk-ollama";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

export type ProviderName = "ollama" | "openai" | "google" | "anthropic";

/**
 * Get a model instance from any supported provider
 * API keys are read from environment variables or settings database
 */
export function getModel(provider: ProviderName, modelId: string) {
  switch (provider) {
    case "ollama":
      return ollama(modelId);
    case "openai":
      return openai(modelId);
    case "google":
      return google(modelId);
    case "anthropic":
      return anthropic(modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Check if a provider is configured (has required API key)
 */
export function isProviderConfigured(provider: ProviderName): boolean {
  switch (provider) {
    case "ollama":
      return true; // Ollama doesn't require API key
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "google":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    default:
      return false;
  }
}

/**
 * Get list of all available providers
 */
export function getAvailableProviders(): ProviderName[] {
  return ["ollama", "openai", "google", "anthropic"];
}

/**
 * Get list of configured providers (those with API keys)
 */
export function getConfiguredProviders(): ProviderName[] {
  return getAvailableProviders().filter(isProviderConfigured);
}
