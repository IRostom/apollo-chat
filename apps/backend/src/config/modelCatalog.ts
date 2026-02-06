export interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  thinking: boolean;
}

export interface ProviderModelConfig {
  name: string;
  label?: string;
  capabilities: ModelCapabilities;
}

export interface ProviderConfig {
  id: "openai" | "google" | "anthropic" | "ollama-cloud";
  label: string;
  models: ProviderModelConfig[];
}

export const MODEL_CATALOG: { providers: ProviderConfig[] } = {
  providers: [
    {
      id: "openai",
      label: "OpenAI",
      models: [
        {
          name: "gpt-4o",
          label: "GPT-4o",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "gpt-4o-mini",
          label: "GPT-4o Mini",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "gpt-4-turbo",
          label: "GPT-4 Turbo",
          capabilities: { vision: false, tools: true, thinking: false },
        },
        {
          name: "gpt-4",
          label: "GPT-4",
          capabilities: { vision: false, tools: true, thinking: false },
        },
        {
          name: "gpt-3.5-turbo",
          label: "GPT-3.5 Turbo",
          capabilities: { vision: false, tools: true, thinking: false },
        },
      ],
    },
    {
      id: "google",
      label: "Google Gemini",
      models: [
        {
          name: "gemini-1.5-pro",
          label: "Gemini 1.5 Pro",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "gemini-1.5-flash",
          label: "Gemini 1.5 Flash",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "gemini-2.0-flash",
          label: "Gemini 2.0 Flash",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "gemini-1.0-pro",
          label: "Gemini 1.0 Pro",
          capabilities: { vision: false, tools: true, thinking: false },
        },
        {
          name: "gemini-1.5-flash-8b",
          label: "Gemini 1.5 Flash 8B",
          capabilities: { vision: true, tools: true, thinking: false },
        },
      ],
    },
    {
      id: "anthropic",
      label: "Anthropic",
      models: [
        {
          name: "claude-3-5-sonnet-20241022",
          label: "Claude 3.5 Sonnet",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "claude-3-opus-20240229",
          label: "Claude 3 Opus",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "claude-3-5-haiku-20241022",
          label: "Claude 3.5 Haiku",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "claude-3-sonnet-20240229",
          label: "Claude 3 Sonnet",
          capabilities: { vision: true, tools: true, thinking: false },
        },
        {
          name: "claude-3-haiku-20240307",
          label: "Claude 3 Haiku",
          capabilities: { vision: true, tools: true, thinking: false },
        },
      ],
    },
    {
      id: "ollama-cloud",
      label: "Ollama (Cloud)",
      models: [
        {
          name: "gpt-oss:20b-cloud",
          label: "GPT-OSS 20B Cloud",
          capabilities: { vision: false, tools: true, thinking: true },
        },
        {
            name: "gpt-oss:120b-cloud",
            label: "GPT-OSS 120B Cloud",
            capabilities: { vision: false, tools: true, thinking: true },
        },
        {
            name: "qwen3-vl:235b-cloud",
            label: "Qwen3 VL 235B Cloud",
            capabilities: { vision: true, tools: true, thinking: true },
        },
        {
            name: "qwen3-next:80b-cloud",
            label: "Qwen3 Next 80B Cloud",
            capabilities: { vision: false, tools: true, thinking: true },
        },
        {
            name: 'gemma3:27b-cloud',
            label: 'Gemma3 27B Cloud',
            capabilities: { vision: true, tools: false, thinking: false },
        },
        {
            name: 'gemini-3-flash-preview:cloud',
            label: 'Gemini 3 Flash Preview Cloud',
            capabilities: { vision: true, tools: true, thinking: true },
        }
      ],
    },
  ],
};
