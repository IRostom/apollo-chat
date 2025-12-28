import cors from "cors";
import { RequestHandler } from "express";

/**
 * This middleware sets up CORS for your Express server
 *
 * @see https://github.com/expressjs/cors
 */
const corsMiddleware: RequestHandler = cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});

export default corsMiddleware;
