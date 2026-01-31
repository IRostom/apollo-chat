import { z } from "zod";
import { zodSchema } from "ai";
import {
  runCodeInContainer,
  type CodeLanguage,
} from "../services/codeExecution";

// Define the parameters schema
const codeToolSchema = z.object({
  language: z
    .enum(["javascript", "python"])
    .describe("The programming language to execute"),
  code: z.string().describe("The code to execute"),
});

/**
 * AI SDK compatible tool for running code in isolated Docker containers
 */
export const runCodeTool = {
  description:
    "Runs JavaScript or Python code in an isolated container and returns the output.",
  inputSchema: zodSchema(codeToolSchema),
  execute: async ({
    language,
    code,
  }: {
    language: "javascript" | "python";
    code: string;
  }) => {
    try {
      const result = await runCodeInContainer(language as CodeLanguage, code);

      // Add helpful error message for non-zero exit codes
      if (result.exitCode !== null && result.exitCode !== 0 && !result.stderr) {
        return {
          ...result,
          stderr: `Process exited with code ${result.exitCode}`,
        };
      }

      return result;
    } catch (error) {
      console.error("Error executing code:", error);
      return {
        language,
        code,
        stdout: "",
        stderr: error instanceof Error ? error.message : "Unknown error",
        exitCode: 1,
        timedOut: false,
        error: "Failed to execute code",
      };
    }
  },
};
