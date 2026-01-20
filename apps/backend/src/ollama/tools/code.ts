import {
  CodeExecutionResult,
  CodeLanguage,
  runCodeInContainer,
} from "../../services/codeExecution";

type CodeToolError = { error: string };

export const runCodeTool = {
  type: "function",
  function: {
    name: "runCode",
    description:
      "Runs JavaScript or Python code in an isolated container and returns the output.",
    parameters: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "The language to execute.",
          enum: ["javascript", "python"],
        },
        code: {
          type: "string",
          description: "The code to execute.",
        },
      },
      required: ["language", "code"],
    },
  },
};

export const codeTools = {
  runCode: async (args: {
    language: CodeLanguage;
    code: string;
  }): Promise<CodeExecutionResult | CodeToolError> => {
    try {
      if (!args?.language || !args?.code) {
        return { error: "Missing required arguments: language and code." };
      }
      if (!["javascript", "python"].includes(args.language)) {
        return { error: "Unsupported language. Use javascript or python." };
      }
      const result = await runCodeInContainer(args.language, args.code);
      if (
        result.exitCode !== null &&
        result.exitCode !== 0 &&
        !result.stderr
      ) {
        return {
          ...result,
          stderr: `Process exited with code ${result.exitCode}`,
        };
      }
      return result;
    } catch (error) {
      console.error("Error calling runCode:", error);
      return { error: `Error calling runCode: ${error}` };
    }
  },
};
