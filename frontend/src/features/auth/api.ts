import { apiClient, refreshAccessToken } from "@/api/client";
import { AuthSuccessData, User } from "./types";

export interface RegisterPayload {
  email: string;
  phone: string;
  password: string;
  role: "FACTORY" | "BUYER";
  company_name: string;
  first_name?: string;
  last_name?: string;
  preferred_language?: "bn" | "en";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthSuccessData> {
    const res = await apiClient.post("/auth/register/", payload);
    return res.data.data;
  },

  async login(payload: LoginPayload): Promise<AuthSuccessData> {
    const res = await apiClient.post("/auth/login/", payload);
    return res.data.data;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get("/auth/me/");
    return res.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout/", {});
  },

  async refreshToken(): Promise<{ access_token: string }> {
    // Route through the shared single-flight refresh to avoid rotation races.
    const access_token = await refreshAccessToken();
    return { access_token };
  },
};
