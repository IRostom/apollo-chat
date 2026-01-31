import { runCodeTool } from "./code";

export { runCodeTool } from "./code";

/**
 * Get all available tools for chat
 * @param enableWebTools - Whether to include web search and fetch tools
 * Note: Web tools are currently not implemented - only code execution is available
 */
export function getTools(enableWebTools: boolean = false) {
  // Return just the code execution tool for now
  // Web tools can be added later once we have a proper implementation
  return {
    runCode: runCodeTool,
  };
}

/**
 * Tool names for reference
 */
export const TOOL_NAMES = {
  RUN_CODE: "runCode",
} as const;
