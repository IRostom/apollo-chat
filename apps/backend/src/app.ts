import express, { Express, Request, Response, NextFunction } from "express";
import "dotenv/config";
import corsMiddleware from "./plugins/cors";
import rootRouter from "./routes/root";
import chatRouter from "./routes/chat";
import conversationRouter from "./routes/conversation";
import ollamaRouter from "./routes/ollamaRouter";
import uploadRouter from "./routes/upload";
import transcribeRouter from "./routes/transcribe";
import path from "path";

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

// Routes
app.use("/", chatRouter);
app.use("/", conversationRouter);
app.use("/", ollamaRouter);
app.use("/", uploadRouter);
app.use("/", transcribeRouter);

// Serve static files from uploads directory
const uploadDir = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadDir));

export default app;
