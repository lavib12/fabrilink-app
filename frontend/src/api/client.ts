import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Single-flight refresh. The backend rotates and blacklists refresh tokens, so two
 * concurrent refresh calls with the same cookie would make the second one fail and
 * log the user out (this happens on every page load under React StrictMode).
 * All callers share one in-flight request instead.
 */
let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/token/refresh/`, {}, { withCredentials: true })
      .then((res) => {
        const token: string | undefined = res.data?.data?.access_token;
        if (!token) {
          throw new Error("Refresh response did not include an access token.");
        }
        useAuthStore.getState().setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const SKIP_REFRESH_URLS = ["/auth/login/", "/auth/register/", "/auth/token/refresh/"];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const shouldRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !SKIP_REFRESH_URLS.some((url) => originalRequest.url?.includes(url));

    if (!shouldRefresh || !originalRequest) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const newAccessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshErr) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(refreshErr);
    }
  }
);
