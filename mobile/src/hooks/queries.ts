import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { catalogApi } from "@/api/endpoints/catalog";
import { companiesApi, type KycUpdate, type VerifyInput } from "@/api/endpoints/companies";
import { ordersApi, type CheckoutInput } from "@/api/endpoints/orders";
import { matchingApi } from "@/api/endpoints/matching";
import type {
  Cart,
  FabricRollCreate,
  OrderStatus,
  RollFilters,
  SourcingRequestInput,
  SourcingStatus,
  Verification,
} from "@/api/types";
import { queryKeys } from "@/queryClient";
import { useAuth } from "@/store/auth";

// ---------- Catalog ----------

export const useCategories = () =>
  useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories, staleTime: 10 * 60_000 });

export const useRolls = (filters: RollFilters, enabled = true) =>
  useQuery({
    queryKey: queryKeys.rolls(filters),
    queryFn: () => catalogApi.rolls(filters),
    staleTime: 2 * 60_000,
    enabled,
  });

export const useRoll = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.roll(id ?? ""),
    queryFn: () => catalogApi.roll(id as string),
    enabled: Boolean(id),
  });

export function useCreateRoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FabricRollCreate) => catalogApi.createRoll(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rolls"] }),
  });
}

// ---------- Companies ----------

export const useFactory = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.factory(id ?? ""),
    queryFn: () => companiesApi.factory(id as string),
    enabled: Boolean(id),
  });

export const useBuyers = (enabled = true) =>
  useQuery({ queryKey: queryKeys.buyers, queryFn: companiesApi.buyers, enabled });

export const useMyCompany = (enabled = true) =>
  useQuery({ queryKey: queryKeys.myCompany, queryFn: companiesApi.myCompany, enabled });

export function useUpdateKyc() {
  const qc = useQueryClient();
  const refreshUser = useAuth((s) => s.refreshUser);
  return useMutation({
    mutationFn: (input: KycUpdate) => companiesApi.updateKyc(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.myCompany });
      await refreshUser();
    },
  });
}

export const useKycQueue = (status: Verification | "ALL") =>
  useQuery({ queryKey: queryKeys.kycQueue(status), queryFn: () => companiesApi.kycQueue(status) });

export function useVerifyCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VerifyInput }) => companiesApi.verify(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc-queue"] }),
  });
}

// ---------- Sourcing requests ----------

export const useSourcingRequests = (status?: SourcingStatus) =>
  useQuery({
    queryKey: queryKeys.sourcingRequests(status),
    queryFn: () => matchingApi.list(status),
    staleTime: 30_000,
  });

export const useSourcingRequest = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.sourcingRequest(id ?? ""),
    queryFn: () => matchingApi.detail(id as string),
    enabled: Boolean(id),
  });

export const useSourcingMatches = (id: string | undefined, enabled = true) =>
  useQuery({
    queryKey: queryKeys.sourcingMatches(id ?? ""),
    queryFn: () => matchingApi.matches(id as string),
    enabled: Boolean(id) && enabled,
  });

export function useCreateSourcingRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SourcingRequestInput) => matchingApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sourcing-requests"] }),
  });
}

export function useCloseSourcingRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fulfilled }: { id: string; fulfilled?: boolean }) =>
      matchingApi.close(id, fulfilled),
    onSuccess: (req) => {
      qc.setQueryData(queryKeys.sourcingRequest(req.id), req);
      void qc.invalidateQueries({ queryKey: ["sourcing-requests"] });
    },
  });
}

// ---------- Cart & orders ----------

export function useCredit() {
  const isBuyer = useAuth((s) => s.status === "authenticated" && s.user?.role === "BUYER");
  return useQuery({ queryKey: queryKeys.credit, queryFn: ordersApi.credit, enabled: isBuyer, staleTime: 30_000 });
}

export function useCart() {
  const isBuyer = useAuth((s) => s.status === "authenticated" && s.user?.role === "BUYER");
  return useQuery({ queryKey: queryKeys.cart, queryFn: ordersApi.cart, staleTime: 0, enabled: isBuyer });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rollId, yards }: { rollId: string; yards: number }) =>
      ordersApi.addToCart(rollId, yards),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cart }),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => ordersApi.removeCartItem(itemId),
    // Optimistic: drop the row immediately, restore it if the server refuses.
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: queryKeys.cart });
      const previous = qc.getQueryData<Cart>(queryKeys.cart);
      if (previous) {
        qc.setQueryData<Cart>(queryKeys.cart, {
          ...previous,
          items: previous.items.filter((i) => i.id !== itemId),
        });
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.cart, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.cart }),
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => ordersApi.checkout(input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.cart }),
        qc.invalidateQueries({ queryKey: ["orders"] }),
        qc.invalidateQueries({ queryKey: ["rolls"] }),
        qc.invalidateQueries({ queryKey: ["roll"] }),
        qc.invalidateQueries({ queryKey: queryKeys.credit }),
      ]);
    },
  });
}

export const useOrders = (status?: OrderStatus) =>
  useQuery({ queryKey: queryKeys.orders(status), queryFn: () => ordersApi.list(status), staleTime: 15_000 });

export const useOrder = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.order(id ?? ""),
    queryFn: () => ordersApi.detail(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  });

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: OrderStatus; notes?: string; location?: string }) =>
      ordersApi.updateStatus(v.id, v.status, v.notes, v.location),
    onSuccess: (order) => {
      qc.setQueryData(queryKeys.order(order.id), order);
      void qc.invalidateQueries({ queryKey: ["orders"] });
      if (order.status === "CANCELLED") void qc.invalidateQueries({ queryKey: ["rolls"] });
    },
  });
}
