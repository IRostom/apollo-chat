import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { fileService } from "../db/fileService";
import {
  getUploadedFileInfo,
  getUploadedFilesInfo,
  uploadMultiple,
  uploadSingle,
} from "../services/uploadService";
import { getPresignedUrl } from "../services/storageService";

const router = Router();

// Single file upload endpoint
router.post("/upload", uploadSingle, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const uploaded = getUploadedFileInfo(req.file);

    // Save file information to database
    const fileRecord = await fileService.createFile(
      uploaded.key,
      req.file.mimetype,
      userId,
    );

    const url = await getPresignedUrl(uploaded.key);

    // Return the file information
    res.json({
      message: "File uploaded successfully",
      id: fileRecord.id,
      key: uploaded.key,
      originalname: req.file.originalname,
      size: req.file.size,
      url,
      type: req.file.mimetype,
      created_at: fileRecord.created_at,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "File upload failed" });
  }
});

// Multiple files upload endpoint
router.post(
  "/upload-multiple",
  uploadMultiple,
  async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadedFiles = getUploadedFilesInfo(
        req.files as Express.Multer.File[],
      );
      const files = [];

      // Process each uploaded file
      for (let i = 0; i < uploadedFiles.length; i += 1) {
        const file = (req.files as Express.Multer.File[])[i];
        const uploaded = uploadedFiles[i];
        // Save file information to database
        const fileRecord = await fileService.createFile(
          uploaded.key,
          file.mimetype,
          userId,
        );

        const url = await getPresignedUrl(uploaded.key);

        files.push({
          id: fileRecord.id,
          key: uploaded.key,
          originalname: file.originalname,
          size: file.size,
          url,
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
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const fileId = req.params.id;

    const file = await fileService.getFileById(fileId, userId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const url = await getPresignedUrl(file.key);

    res.json({
      ...file,
      url,
    });
  } catch (error) {
    console.error("Get file error:", error);
    res.status(500).json({ error: "Failed to retrieve file" });
  }
});

export default router;
