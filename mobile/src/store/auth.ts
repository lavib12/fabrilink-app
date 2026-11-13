import { create } from "zustand";

import { setAuthFailureHandler } from "@/api/client";
import { authApi, type RegisterInput } from "@/api/endpoints/auth";
import { tokenStorage } from "@/api/tokenStorage";
import type { AuthPayload, User } from "@/api/types";
import i18n from "@/i18n";
import { queryClient } from "@/queryClient";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthState {
  status: Status;
  user: User | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
  /** Local-only reset (used when the server rejects our refresh token). */
  reset: () => void;
}

function applyUserLanguage(user: User) {
  const lang = user.profile?.preferred_language;
  if (lang && lang !== i18n.language) void i18n.changeLanguage(lang);
}

export const useAuth = create<AuthState>()((set, get) => {
  const acceptSession = async (payload: AuthPayload): Promise<User> => {
    if (!payload.refresh_token) {
      // Means the backend isn't honouring X-Client-Platform: mobile.
      throw new Error("Server did not return a refresh token for this mobile session.");
    }
    await tokenStorage.save({ access: payload.access_token, refresh: payload.refresh_token });
    queryClient.clear();
    applyUserLanguage(payload.user);
    set({ status: "authenticated", user: payload.user });
    return payload.user;
  };

  return {
    status: "loading",
    user: null,

    async bootstrap() {
      const { refresh } = await tokenStorage.load();
      if (!refresh) {
        set({ status: "anonymous", user: null });
        return;
      }
      try {
        // A stale access token is refreshed transparently by the interceptor.
        const user = await authApi.me();
        applyUserLanguage(user);
        set({ status: "authenticated", user });
      } catch {
        await tokenStorage.clear();
        set({ status: "anonymous", user: null });
      }
    },

    async login(email, password) {
      return acceptSession(await authApi.login(email.trim(), password));
    },

    async register(input) {
      return acceptSession(await authApi.register(input));
    },

    async refreshUser() {
      if (get().status !== "authenticated") return null;
      const user = await authApi.me();
      set({ user });
      return user;
    },

    async logout() {
      const { refresh } = await tokenStorage.load();
      try {
        await authApi.logout(refresh);
      } catch {
        // Logging out locally matters more than the server acknowledging it.
      }
      await tokenStorage.clear();
      queryClient.clear();
      set({ status: "anonymous", user: null });
    },

    reset() {
      queryClient.clear();
      set({ status: "anonymous", user: null });
    },
  };
});

setAuthFailureHandler(() => useAuth.getState().reset());
