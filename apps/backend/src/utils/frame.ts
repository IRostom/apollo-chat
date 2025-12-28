/**
 * Utility for formatting NDJSON frames used by the chat streaming API.
 *
 * Each frame is a JSON object that must include a `type` field.  Optional
 * properties are passed via the `payload` argument and are merged into the
 * object.  A newline (`\n`) is appended so the string can be written
 * directly to `res.write()` or similar.
 *
 * @param type    The frame type, e.g. `"start"`, `"token"`, `"tool"`, `"done"`,
 *                `"error"`, etc.
 * @param payload Optional key/value pairs to include in the frame.
 * @returns A string ready to write to an HTTP response stream.
 */
export function frame(
  type: string,
  payload: Record<string, unknown> = {}
): string {
  return JSON.stringify({ type, ...payload }) + "\n";
}
