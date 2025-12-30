import { Router, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { fileService } from "../db/fileService";

const router = Router();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to avoid conflicts
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

// File filter to allow only specific file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  // Allow all file types, but you can restrict to specific types if needed
  // For example, to allow only images:
  // if (file.mimetype.startsWith('image/')) {
  //   cb(null, true);
  // } else {
  //   cb(new Error('Only image files are allowed!'));
  // }

  cb(null, true); // Accept all files
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

// Single file upload endpoint
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Save file information to database
      const fileRecord = await fileService.createFile(
        req.file.filename,
        `/${req.file.filename}`,
        req.file.mimetype,
      );

      // Return the file information
      res.json({
        message: "File uploaded successfully",
        id: fileRecord.id,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: fileRecord.path,
        type: req.file.mimetype,
        created_at: fileRecord.created_at,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "File upload failed" });
    }
  },
);

// Multiple files upload endpoint
router.post(
  "/upload-multiple",
  upload.array("files", 5),
  async (req: Request, res: Response) => {
    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const files = [];

      // Process each uploaded file
      for (const file of req.files as Express.Multer.File[]) {
        // Save file information to database
        const fileRecord = await fileService.createFile(
          file.filename,
          `/${file.filename}`,
          file.mimetype,
        );

        files.push({
          id: fileRecord.id,
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          path: fileRecord.path,
          type: file.mimetype,
          created_at: fileRecord.created_at,
        });
      }

      res.json({
        message: "Files uploaded successfully",
        count: files.length,
        files: files,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Files upload failed" });
    }
  },
);

// Get file by ID endpoint
router.get("/file/:id", async (req: Request, res: Response) => {
  try {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    const file = await fileService.getFileById(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json(file);
  } catch (error) {
    console.error("Get file error:", error);
    res.status(500).json({ error: "Failed to retrieve file" });
  }
});

export default router;
