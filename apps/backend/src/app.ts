import express, { Express } from "express";
import "dotenv/config";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import corsMiddleware from "./plugins/cors";
import ollamaRouter from "./routes/ollamaRouter";
import uploadRouter from "./routes/upload";
import transcribeRouter from "./routes/transcribe";
import modelsRouter from "./routes/models";
// V1 API routes (AI SDK)
import v1ChatRouter from "./routes/v1/chat";
import v1ConversationRouter from "./routes/v1/conversation";
import v1ModelsRouter from "./routes/v1/models";

const app: Express = express();

// Process error handlers
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Log the error details here
  process.exit(1); // Exit to prevent memory leaks and unstable state
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Log the reason details here
  // Depending on your policy, you might want to exit the process
});

// Body parsing middleware
app.use(express.json());

// CORS middleware
app.use(corsMiddleware);

// Clerk auth middleware (parses session JWT from Authorization header)
app.use(clerkMiddleware());

// Routes (all protected by requireAuth)
app.use("/", requireAuth(), ollamaRouter);
app.use("/", requireAuth(), uploadRouter);
app.use("/", requireAuth(), transcribeRouter);
app.use("/", requireAuth(), modelsRouter);

// V1 API routes (AI SDK based, all protected)
app.use("/api/v1/chat", requireAuth(), v1ChatRouter);
app.use("/api/v1/conversations", requireAuth(), v1ConversationRouter);
app.use("/api/v1/models", requireAuth(), v1ModelsRouter);

export default app;
