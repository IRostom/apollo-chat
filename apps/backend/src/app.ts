import express, { Express, Request, Response, NextFunction } from "express";
import "dotenv/config";
import corsMiddleware from "./plugins/cors";
import rootRouter from "./routes/root";
import chatRouter from "./routes/chat";
import conversationRouter from "./routes/conversation";
import ollamaRouter from "./routes/ollamaRouter";

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
app.use("/", rootRouter);
app.use("/", chatRouter);
app.use("/", conversationRouter);
app.use("/", ollamaRouter);

export default app;
