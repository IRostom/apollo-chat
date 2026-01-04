import fs from "fs";
import path from "path";
import { fileService } from "../db/fileService";

/**
 * Convert a file path to base64 string
 * @param filePath - Path to the file
 * @returns Base64 encoded string of the file
 */
export async function fileToBase64(filePath: string): Promise<string> {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return fileBuffer.toString("base64");
  } catch (error) {
    console.error("Error reading file:", error);
    throw new Error(`Failed to read file: ${filePath}`);
  }
}

/**
 * Get file path from file ID
 * @param fileId - ID of the file
 * @returns Full file path
 */
export async function getFilePathById(fileId: number): Promise<string> {
  try {
    const fileRecord = await fileService.getFileById(fileId);
    if (!fileRecord) {
      throw new Error(`File with ID ${fileId} not found`);
    }

    // Construct full file path
    const uploadDir = path.join(__dirname, "../../uploads/");
    return path.join(uploadDir, fileRecord.path);
  } catch (error) {
    console.error("Error getting file path:", error);
    throw new Error(`Failed to get file path for ID ${fileId}`);
  }
}

/**
 * Convert array of file IDs to base64 strings
 * @param fileIds - Array of file IDs
 * @returns Array of base64 encoded strings
 */
export async function convertImageIdsToBase64(
  fileIds: string[]
): Promise<string[]> {
  try {
    const base64Images: string[] = [];

    for (const fileId of fileIds) {
      const filePath = await getFilePathById(+fileId);
      const base64Image = await fileToBase64(filePath);
      base64Images.push(base64Image);
    }

    return base64Images;
  } catch (error) {
    console.error("Error converting image IDs to base64:", error);
    throw new Error("Failed to convert image IDs to base64");
  }
}
