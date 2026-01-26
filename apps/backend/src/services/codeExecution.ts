import Docker from "dockerode";
import { PassThrough } from "stream";

export type CodeLanguage = "javascript" | "python";

export interface CodeExecutionResult {
  language: CodeLanguage;
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

const IMAGE_BY_LANGUAGE: Record<CodeLanguage, string> = {
  javascript: "node:20-alpine",
  python: "python:3.11-alpine",
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MEMORY_BYTES = 128 * 1024 * 1024;
const DEFAULT_CPU_PERIOD = 100_000;
const DEFAULT_CPU_QUOTA = 100_000;
const DEFAULT_PIDS_LIMIT = 64;
const MAX_OUTPUT_BYTES = 64 * 1024;

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { statusCode?: number; message?: string; reason?: string };
  if (candidate.statusCode === 404) {
    return true;
  }
  const message = `${candidate.message ?? ""} ${candidate.reason ?? ""}`.trim();
  return message ? /no such container/i.test(message) : false;
}

function createDockerClient(): Docker {
  const socketPath = process.env.DOCKER_SOCKET_PATH;
  if (socketPath && socketPath.trim()) {
    return new Docker({ socketPath });
  }
  return new Docker();
}

const dockerClient = createDockerClient();

async function ensureImage(image: string): Promise<void> {
  try {
    await dockerClient.getImage(image).inspect();
  } catch {
    await new Promise<void>((resolve, reject) => {
      dockerClient.pull(
        image,
        (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        if (!stream) {
          resolve();
          return;
        }
        dockerClient.modem.followProgress(stream, (pullErr) => {
          if (pullErr) {
            reject(pullErr);
            return;
          }
          resolve();
        });
        }
      );
    });
  }
}

function commandForLanguage(language: CodeLanguage, code: string): string[] {
  if (language === "javascript") {
    return ["node", "-e", code];
  }
  return ["python", "-c", code];
}

export async function runCodeInContainer(
  language: CodeLanguage,
  code: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<CodeExecutionResult> {
  const image = IMAGE_BY_LANGUAGE[language];
  await ensureImage(image);

  const container = await dockerClient.createContainer({
    Image: image,
    Cmd: commandForLanguage(language, code),
    Tty: false,
    AttachStdout: true,
    AttachStderr: true,
    User: "nobody",
    HostConfig: {
      AutoRemove: true,
      NetworkMode: "none",
      Memory: DEFAULT_MEMORY_BYTES,
      CpuPeriod: DEFAULT_CPU_PERIOD,
      CpuQuota: DEFAULT_CPU_QUOTA,
      PidsLimit: DEFAULT_PIDS_LIMIT,
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
    },
  });

  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();
  let stdout = "";
  let stderr = "";
  let stdoutSize = 0;
  let stderrSize = 0;
  const appendWithLimit = (
    current: string,
    currentSize: number,
    chunk: Buffer
  ): { text: string; size: number } => {
    if (currentSize >= MAX_OUTPUT_BYTES) {
      return { text: current, size: currentSize };
    }
    const remainingBytes = MAX_OUTPUT_BYTES - currentSize;
    const chunkText = chunk.toString();
    const truncatedChunk = Buffer.from(chunkText)
      .subarray(0, remainingBytes)
      .toString();
    const nextText = current + truncatedChunk;
    const nextSize = currentSize + Buffer.byteLength(truncatedChunk);
    return { text: nextText, size: nextSize };
  };

  stdoutStream.on("data", (chunk) => {
    const next = appendWithLimit(stdout, stdoutSize, chunk as Buffer);
    stdout = next.text;
    stdoutSize = next.size;
  });
  stderrStream.on("data", (chunk) => {
    const next = appendWithLimit(stderr, stderrSize, chunk as Buffer);
    stderr = next.text;
    stderrSize = next.size;
  });

  const attachStream = await container.attach({
    stream: true,
    stdout: true,
    stderr: true,
  });
  dockerClient.modem.demuxStream(attachStream, stdoutStream, stderrStream);

  await container.start();

  const streamDone = new Promise<void>((resolve) => {
    attachStream.on("end", resolve);
    attachStream.on("close", resolve);
  });

  let timedOut = false;
  const waitPromise = container.wait();
  const waitPromiseHandled = waitPromise.catch((error) => {
    if (isNotFoundError(error)) {
      return undefined;
    }
    console.warn("container.wait error:", error);
    throw error;
  });
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  const waitResult = await Promise.race([waitPromiseHandled, timeoutPromise]);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  if (waitResult === "timeout") {
    timedOut = true;
    try {
      await container.stop({ t: 0 });
    } catch (error) {
      console.warn("Failed to stop timed out container:", error);
    }
    try {
      await container.remove({ force: true });
    } catch (error) {
      console.warn("Failed to remove timed out container:", error);
    }
  }

  await streamDone;

  const exitCode =
    waitResult === "timeout"
      ? null
      : typeof waitResult?.StatusCode === "number"
      ? waitResult.StatusCode
      : null;

  return {
    language,
    code,
    stdout,
    stderr,
    exitCode,
    timedOut,
  };
}
