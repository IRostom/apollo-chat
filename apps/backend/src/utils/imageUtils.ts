import { bodyToBuffer } from "./bufferUtils";
import { fileService } from "../db/fileService";
import { getObject } from "../services/storageService";

/**
 * Get file key from file ID
 * @param fileId - ID of the file
 * @returns S3 object key
 */
export async function getFileKeyById(fileId: string): Promise<string> {
  try {
    const fileRecord = await fileService.getFileById(fileId);
    if (!fileRecord) {
      throw new Error(`File with ID ${fileId} not found`);
    }

    return fileRecord.key;
  } catch (error) {
    console.error("Error getting file key:", error);
    throw new Error(`Failed to get file key for ID ${fileId}`);
  }
}

/**
 * Convert array of file IDs to base64 strings
 * @param fileIds - Array of file IDs
 * @returns Array of base64 encoded strings
 */
export async function convertImageIdsToBase64(
  fileIds: string[],
): Promise<string[]> {
  try {
    const base64Images: string[] = [];

    for (const fileId of fileIds) {
      const key = await getFileKeyById(fileId);
      const object = await getObject(key);
      if (!object.Body) {
        throw new Error(`Missing body for object: ${key}`);
      }
      const buffer = await bodyToBuffer(object.Body);
      const base64Image = buffer.toString("base64");
      base64Images.push(base64Image);
    }

    return base64Images;
  } catch (error) {
    console.error("Error converting image IDs to base64:", error);
    throw new Error("Failed to convert image IDs to base64");
  }
}
