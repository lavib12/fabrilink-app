import { apiClient } from "../client";
import type { AuthPayload, User } from "../types";

export interface RegisterInput {
  email: string;
  phone: string;
  password: string;
  role: "FACTORY" | "BUYER";
  company_name: string;
  first_name?: string;
  last_name?: string;
  preferred_language?: "bn" | "en";
}

export interface ProfileUpdate {
  first_name?: string;
  last_name?: string;
  designation?: string;
  preferred_language?: "bn" | "en";
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthPayload> {
    const res = await apiClient.post("/auth/login/", { email, password });
    return res.data.data;
  },
  async register(input: RegisterInput): Promise<AuthPayload> {
    const res = await apiClient.post("/auth/register/", input);
    return res.data.data;
  },
  async me(): Promise<User> {
    const res = await apiClient.get("/auth/me/");
    return res.data.data;
  },
  async updateProfile(input: ProfileUpdate): Promise<User> {
    const res = await apiClient.patch("/auth/me/", input);
    return res.data.data;
  },
  async logout(refresh: string | null): Promise<void> {
    await apiClient.post("/auth/logout/", refresh ? { refresh } : {});
  },
};
