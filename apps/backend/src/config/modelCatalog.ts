export interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  thinking: boolean;
  pdf: boolean;
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
          name: 'gpt-5',
          label: 'GPT-5',
          capabilities: { vision: true, tools: true, thinking: true, pdf: true },
        },
        {
          name: "gpt-5-mini",
          label: "GPT-5 Mini",
          capabilities: { vision: true, tools: true, thinking: true, pdf: true },
        },
        {
          name: "gpt-5-nano",
          label: "GPT-5 Nano",
          capabilities: { vision: true, tools: true, thinking: true, pdf: true },
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
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
        },
        {
          name: "gemini-1.5-flash",
          label: "Gemini 1.5 Flash",
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
        },
        {
          name: "gemini-2.0-flash",
          label: "Gemini 2.0 Flash",
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
        },
        {
          name: "gemini-1.0-pro",
          label: "Gemini 1.0 Pro",
          capabilities: { vision: false, tools: true, thinking: false, pdf: true },
        },
        {
          name: "gemini-1.5-flash-8b",
          label: "Gemini 1.5 Flash 8B",
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
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
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
        },
        {
          name: "claude-3-opus-20240229",
          label: "Claude 3 Opus",
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
        },
        {
          name: "claude-3-5-haiku-20241022",
          label: "Claude 3.5 Haiku",
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
        },
        {
          name: "claude-3-sonnet-20240229",
          label: "Claude 3 Sonnet",
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
        },
        {
          name: "claude-3-haiku-20240307",
          label: "Claude 3 Haiku",
          capabilities: { vision: true, tools: true, thinking: false, pdf: true },
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
            capabilities: { vision: false, tools: true, thinking: true, pdf: false },
        },
        {
            name: "gpt-oss:120b-cloud",
            label: "GPT-OSS 120B Cloud",
            capabilities: { vision: false, tools: true, thinking: true, pdf: false },
        },
        {
            name: "qwen3-vl:235b-cloud",
            label: "Qwen3 VL 235B Cloud",
            capabilities: { vision: true, tools: true, thinking: true, pdf: false },
        },
        {
            name: "qwen3-next:80b-cloud",
            label: "Qwen3 Next 80B Cloud",
            capabilities: { vision: false, tools: true, thinking: true, pdf: false },
        },
        {
            name: 'gemma3:27b-cloud',
            label: 'Gemma3 27B Cloud',
            capabilities: { vision: true, tools: false, thinking: false, pdf: false },
        },
        {
            name: 'gemini-3-flash-preview:cloud',
            label: 'Gemini 3 Flash Preview Cloud',
            capabilities: { vision: true, tools: true, thinking: true, pdf: false },
        }
      ],
    },
  ],
};
