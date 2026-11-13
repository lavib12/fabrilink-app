import { isAxiosError } from "axios";

interface ErrorEnvelope {
  success: false;
  error?: { code?: string; message?: string; details?: unknown };
}

function envelope(err: unknown): ErrorEnvelope["error"] | undefined {
  if (isAxiosError<ErrorEnvelope>(err)) return err.response?.data?.error;
  return undefined;
}

/** Human-readable message for any thrown value (server message first). */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const serverMessage = envelope(err)?.message;
  if (serverMessage) return serverMessage;
  if (isAxiosError(err) && !err.response) {
    return "Can't reach the FabriLink server. Check your connection.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function getErrorCode(err: unknown): string | undefined {
  return envelope(err)?.code;
}

export function isNetworkError(err: unknown): boolean {
  return isAxiosError(err) && !err.response;
}

/** DRF field errors (`{ field: ["msg"] }`) flattened to `{ field: "msg" }`. */
export function getFieldErrors(err: unknown): Record<string, string> {
  const details = envelope(err)?.details;
  const out: Record<string, string> = {};
  if (details && typeof details === "object" && !Array.isArray(details)) {
    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      if (key === "detail") continue;
      if (Array.isArray(value) && value.length > 0) out[key] = String(value[0]);
      else if (typeof value === "string") out[key] = value;
    }
  }
  return out;
}
