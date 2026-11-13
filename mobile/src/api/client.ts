import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL, CLIENT_PLATFORM_HEADER } from "@/config";
import { singleFlight } from "@/lib/singleFlight";

import { tokenStorage } from "./tokenStorage";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: { "Content-Type": "application/json", ...CLIENT_PLATFORM_HEADER },
});

/** Called when the session can no longer be refreshed (wired up by the auth store). */
let onAuthFailure: () => void = () => {};
export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

/**
 * Refresh tokens are rotated and blacklisted server-side, so two parallel refreshes
 * with the same token would log the user out. All callers share one request.
 */
export const refreshAccessToken = singleFlight(async (): Promise<string> => {
  const { refresh } = await tokenStorage.load();
  if (!refresh) throw new Error("No refresh token stored.");

  const res = await axios.post(
    `${API_BASE_URL}/auth/token/refresh/`,
    { refresh },
    { headers: { "Content-Type": "application/json", ...CLIENT_PLATFORM_HEADER }, timeout: 20_000 }
  );
  const access: string | undefined = res.data?.data?.access_token;
  const rotated: string | undefined = res.data?.data?.refresh_token;
  if (!access) throw new Error("Refresh response did not include an access token.");
  await tokenStorage.save({ access, refresh: rotated ?? refresh });
  return access;
});

apiClient.interceptors.request.use(async (config) => {
  const { access } = await tokenStorage.load();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

const NO_REFRESH_PATHS = ["/auth/login/", "/auth/register/", "/auth/token/refresh/"];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const eligible =
      error.response?.status === 401 &&
      original !== undefined &&
      !original._retry &&
      !NO_REFRESH_PATHS.some((p) => original.url?.includes(p));

    if (!eligible || !original) throw error;

    original._retry = true;
    try {
      const access = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${access}`;
      return apiClient(original);
    } catch {
      await tokenStorage.clear();
      onAuthFailure();
      throw error;
    }
  }
);
