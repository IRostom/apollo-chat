/**
 * Shared body-to-Buffer conversion utility.
 * Unifies handling across filePartService and imageUtils to prevent divergent behavior.
 */

/**
 * Convert a stream or body to a Buffer.
 * Supports: Buffer, Uint8Array, string, ArrayBuffer, Web ReadableStream,
 * Node.js ReadableStream, and S3-style transformToByteArray/arrayBuffer.
 *
 * @param body - The body to convert (from S3 getObject, fetch, etc.)
 * @returns Buffer
 * @throws Error when body is null/undefined or type is unsupported
 */
export async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Object body is undefined or empty");
  }

  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);

  const anyBody = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
    getReader?: () => ReadableStreamDefaultReader<Uint8Array>;
    on?: (event: string, cb: (chunk: unknown) => void) => void;
  };

  if (typeof anyBody?.transformToByteArray === "function") {
    return Buffer.from(await anyBody.transformToByteArray());
  }

  if (typeof anyBody?.arrayBuffer === "function") {
    return Buffer.from(await anyBody.arrayBuffer());
  }

  if (typeof anyBody?.getReader === "function") {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const chunks: Buffer[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  if (typeof anyBody?.on === "function") {
    const stream = body as NodeJS.ReadableStream;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
      });
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  throw new Error("Unsupported object body type");
}
