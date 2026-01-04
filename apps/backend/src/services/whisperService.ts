import { spawn } from "child_process";
import path from "path";

export interface TranscriptionResult {
  text: string;
  language: string;
}

export interface TranscriptionError {
  error: string;
}

/**
 * Transcribe audio using OpenAI's Whisper model via Python subprocess
 * @param audioPath - Path to the audio file to transcribe
 * @param model - Whisper model name (default: "turbo")
 * @returns Promise with transcription result containing text and detected language
 */
export async function transcribe(
  audioPath: string,
  model: string = "turbo"
): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "whisper-service.py");

    const pythonProcess = spawn("python", [
      scriptPath,
      "--model",
      model,
      "--audio",
      audioPath,
    ]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code: number | null) => {
      if (code !== 0) {
        // Try to parse stderr as JSON error
        try {
          const errorData: TranscriptionError = JSON.parse(stderr.trim());
          reject(new Error(errorData.error));
        } catch {
          reject(
            new Error(stderr || `Python process exited with code ${code}`)
          );
        }
        return;
      }

      try {
        const result: TranscriptionResult = JSON.parse(stdout.trim());
        resolve(result);
      } catch (parseError) {
        reject(new Error(`Failed to parse transcription result: ${stdout}`));
      }
    });

    pythonProcess.on("error", (error: Error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}
