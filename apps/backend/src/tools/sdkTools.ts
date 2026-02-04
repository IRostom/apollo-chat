import { tool } from "ai";
import { z } from "zod";
import { ollama } from "ai-sdk-ollama";
import {
  runCodeInContainer,
  type CodeLanguage,
} from "../services/codeExecution";

/**
 * Code execution tool - runs JavaScript or Python code in an isolated Docker container
 * Available for all providers
 */
export const runCodeTool = tool({
  description:
    "Runs JavaScript or Python code in an isolated container and returns the output. Use this tool when you need to execute code, perform calculations, or process data.",
  inputSchema: z.object({
    language: z
      .enum(["javascript", "python"])
      .describe("The programming language to execute"),
    code: z.string().describe("The code to execute"),
  }),
  execute: async ({ language, code }) => {
    return runCodeInContainer(language as CodeLanguage, code);
  },
});

/**
 * Web search tool from ai-sdk-ollama
 * Available for ALL providers (uses Ollama's web API regardless of chat provider)
 */
export const webSearchTool = ollama.tools.webSearch({ maxResults: 5 });

/**
 * Web fetch tool from ai-sdk-ollama
 * Available for ALL providers (uses Ollama's web API regardless of chat provider)
 */
export const webFetchTool = ollama.tools.webFetch();

/**
 * Get tools based on enabled features
 * @param options - Tool configuration options
 * @returns Object containing enabled tools
 */
export function getEnabledTools(options: {
  enableCodeTools?: boolean;
  enableWebTools?: boolean;
}) {
  const tools: Record<string, any> = {};

  if (options.enableCodeTools) {
    tools.runCode = runCodeTool;
  }

  if (options.enableWebTools) {
    tools.webSearch = webSearchTool;
    tools.webFetch = webFetchTool;
  }

  return tools;
}
