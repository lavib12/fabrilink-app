import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Don't retry client errors (403/404/400) — only flaky network / 5xx.
      retry: (count, err) => {
        if (isAxiosError(err) && err.response && err.response.status < 500) return false;
        return count < 2;
      },
    },
  },
});

export const queryKeys = {
  me: ["me"] as const,
  myCompany: ["my-company"] as const,
  categories: ["categories"] as const,
  rolls: (filters: object) => ["rolls", filters] as const,
  roll: (id: string) => ["roll", id] as const,
  factories: ["factories"] as const,
  factory: (id: string) => ["factory", id] as const,
  buyers: ["buyers"] as const,
  cart: ["cart"] as const,
  orders: (status?: string) => ["orders", status ?? "all"] as const,
  order: (id: string) => ["order", id] as const,
  kycQueue: (status: string) => ["kyc-queue", status] as const,
  credit: ["credit"] as const,
  sourcingRequests: (status?: string) => ["sourcing-requests", status ?? "all"] as const,
  sourcingRequest: (id: string) => ["sourcing-request", id] as const,
  sourcingMatches: (id: string) => ["sourcing-matches", id] as const,
};
