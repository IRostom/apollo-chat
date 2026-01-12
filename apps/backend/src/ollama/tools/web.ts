import { WebFetchResponse, WebSearchResponse } from "ollama";
import { ollamaClient } from "../client";

// Tool schemas
export const webSearchTool = {
  type: "function",
  function: {
    name: "webSearch",
    description: "Performs a web search for the given query.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string." },
        max_results: {
          type: "number",
          description:
            "The maximum number of results to return per query (default 3).",
        },
      },
      required: ["query"],
    },
  },
};

export const webFetchTool = {
  type: "function",
  function: {
    name: "webFetch",
    description: "Fetches a single page by URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "A single URL to fetch." },
      },
      required: ["url"],
    },
  },
};

type WebToolError = { error: string };

export const webTools = {
  webSearch: async (args: {
    query: string;
    max_results?: number;
  }): Promise<WebSearchResponse | WebToolError> => {
    try {
      const res = await ollamaClient.webSearch(args);
      return res as WebSearchResponse;
    } catch (error) {
      console.error("Error calling webSearch:", error);
      return { error: `Error calling webSearch: ${error}` };
    }
  },
  webFetch: async (args: {
    url: string;
  }): Promise<WebFetchResponse | WebToolError> => {
    try {
      const res = await ollamaClient.webFetch(args);
      return res as WebFetchResponse;
    } catch (error) {
      console.error("Error calling webFetch:", error);
      return { error: `Error calling webFetch: ${error}` };
    }
  },
};
