import type { UIMessage, FileUIPart } from "ai";
import { bodyToBuffer } from "../utils/bufferUtils";
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

async function keyToBase64DataUrl(
  key: string,
  mediaType: string | undefined,
): Promise<string> {
  const object = await getObject(key);
  if (!object.Body) {
    throw new Error(`Missing body for S3 object: ${key}`);
  }
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
