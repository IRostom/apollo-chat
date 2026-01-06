import { Ollama } from "ollama";

// Use OLLAMA_HOST env var for Docker support (connects to host machine)
// Falls back to default localhost:11434 for local development
export const ollamaClient = new Ollama({
  host: process.env.OLLAMA_HOST || "http://localhost:11434",
});
