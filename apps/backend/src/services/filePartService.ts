import type { UIMessage, FileUIPart } from "ai";
import { getObject, getPresignedUrl } from "./storageService";

const OLLAMA_PROVIDERS = new Set(["ollama", "ollama-local", "ollama-cloud"]);

export function isOllamaProvider(provider: string): boolean {
  return OLLAMA_PROVIDERS.has(provider);
}

function isKeyUrl(url: string): boolean {
  return !url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:");
}

function isFilePart(part: unknown): part is FileUIPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as FileUIPart).type === "file" &&
    typeof (part as FileUIPart).url === "string"
  );
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  if (typeof (body as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
    const buffer = await (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(buffer);
  }

  if (typeof (body as NodeJS.ReadableStream).on === "function") {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      (body as NodeJS.ReadableStream).on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      (body as NodeJS.ReadableStream).on("end", () => resolve(Buffer.concat(chunks)));
      (body as NodeJS.ReadableStream).on("error", reject);
    });
  }

  throw new Error("Unsupported S3 body type for base64 conversion");
}

async function keyToBase64DataUrl(
  key: string,
  mediaType: string | undefined,
): Promise<string> {
  const object = await getObject(key);
  const bodyBuffer = await bodyToBuffer(object.Body);
  const contentType = mediaType || object.ContentType || "application/octet-stream";
  return `data:${contentType};base64,${bodyBuffer.toString("base64")}`;
}

async function mapUIMessagesFileParts(
  messages: UIMessage[],
  mapper: (part: FileUIPart) => Promise<string>,
): Promise<UIMessage[]> {
  return Promise.all(
    messages.map(async (message) => {
      if (!Array.isArray(message.parts)) {
        return message;
      }

      let changed = false;
      const parts = await Promise.all(
        message.parts.map(async (part) => {
          if (!isFilePart(part) || !isKeyUrl(part.url)) {
            return part;
          }

          const newUrl = await mapper(part);
          changed = true;
          return { ...part, url: newUrl };
        }),
      );

      return changed ? { ...message, parts } : message;
    }),
  );
}

export async function expandUIMessagesForProvider(
  messages: UIMessage[],
  provider: string,
): Promise<UIMessage[]> {
  if (isOllamaProvider(provider)) {
    return mapUIMessagesFileParts(messages, (part) =>
      keyToBase64DataUrl(part.url, part.mediaType),
    );
  }

  return mapUIMessagesFileParts(messages, (part) => getPresignedUrl(part.url));
}

export async function hydrateUIMessagesWithPresignedUrls(
  messages: UIMessage[],
): Promise<UIMessage[]> {
  return mapUIMessagesFileParts(messages, (part) => getPresignedUrl(part.url));
}
