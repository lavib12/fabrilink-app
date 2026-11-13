import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { refreshAccessToken } from "@/api/client";
import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/store";
import "@/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Restores the session once per page load. Shared as a module-level promise so that
 * React StrictMode's double effect invocation doesn't trigger two refreshes.
 */
let restorePromise: Promise<void> | null = null;

const restoreSession = (): Promise<void> => {
  if (!restorePromise) {
    restorePromise = (async () => {
      const store = useAuthStore.getState();
      try {
        // No persisted token: get one from the httpOnly refresh cookie first.
        // With a persisted token, getMe() refreshes automatically on a 401.
        if (!store.accessToken) {
          await refreshAccessToken();
        }
        const user = await authApi.getMe();
        const token = useAuthStore.getState().accessToken;
        if (token) {
          useAuthStore.getState().setAuth(user, token);
        } else {
          useAuthStore.getState().clearAuth();
        }
      } catch {
        // Don't leave a stale persisted user "logged in" with a dead token.
        useAuthStore.getState().clearAuth();
      } finally {
        useAuthStore.getState().setInitialized(true);
      }
    })();
  }
  return restorePromise;
};

const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    restoreSession();
  }, []);

  return <>{children}</>;
};


export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>{children}</AuthInitializer>
    </QueryClientProvider>
  );
};
