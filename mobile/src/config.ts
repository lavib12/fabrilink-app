import { Platform } from "react-native";

/**
 * Resolves the API base URL. `EXPO_PUBLIC_API_BASE_URL` wins; otherwise we pick the
 * address at which a backend running on the developer's machine is reachable.
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  // The Android emulator reaches the host machine through 10.0.2.2.
  if (Platform.OS === "android") return "http://10.0.2.2:8000/api/v1";
  return "http://localhost:8000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Sent on every request so the backend returns refresh tokens in the body. */
export const CLIENT_PLATFORM_HEADER = { "X-Client-Platform": "mobile" } as const;
