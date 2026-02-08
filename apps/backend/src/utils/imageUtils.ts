import { fileService } from "../db/fileService";
import { getObject } from "../services/storageService";

/**
 * Convert a stream or body to a Buffer.
 * @returns Buffer for the object body
 */
async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Object body is undefined");
  }
  if (body instanceof Buffer) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);

  const anyBody = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
    getReader?: () => ReadableStreamDefaultReader<Uint8Array>;
    on?: (event: string, cb: (chunk: unknown) => void) => void;
  };

  if (anyBody?.transformToByteArray) {
    return Buffer.from(await anyBody.transformToByteArray());
  }

  const getReader = anyBody?.getReader;
  if (typeof getReader === "function") {
    const reader = getReader();
    const chunks: Buffer[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  const on = anyBody?.on;
  if (typeof on === "function") {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
      });
      on("end", () => resolve(Buffer.concat(chunks)));
      on("error", reject);
    });
  }

  throw new Error("Unsupported object body type");
}

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
