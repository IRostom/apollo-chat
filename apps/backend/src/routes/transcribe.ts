import { Router, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { transcribe } from "../services/whisperService";

const router = Router();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage for audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "audio-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to allow only audio file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedMimeTypes = [
    "audio/wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
  ];

  console.log("file.mimetype", file.mimetype);
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
  },
});

// POST /transcribe - Transcribe audio file
router.post(
  "/transcribe",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      const audioPath = req.file.path;
      const model = (req.body.model as string) || "turbo";

      // Call whisper transcription service
      const result = await transcribe(audioPath, model);

      // Optionally clean up the uploaded file after transcription
      // Uncomment the following line if you want to delete the file after processing
      // fs.unlinkSync(audioPath);

      res.json({
        success: true,
        text: result.text,
        language: result.language,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({
        error: "Transcription failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
