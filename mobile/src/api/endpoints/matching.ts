import { apiClient } from "../client";
import type { FabricRollListItem, SourcingRequest, SourcingRequestInput, SourcingStatus } from "../types";

export const matchingApi = {
  /** Buyers: their own. Verified factories: open requests. Admins: all. */
  async list(status?: SourcingStatus): Promise<SourcingRequest[]> {
    const res = await apiClient.get("/matching/requests/", { params: status ? { status } : undefined });
    return res.data.data;
  },
  async detail(id: string): Promise<SourcingRequest> {
    const res = await apiClient.get(`/matching/requests/${id}/`);
    return res.data.data;
  },
  async create(input: SourcingRequestInput): Promise<SourcingRequest> {
    const res = await apiClient.post("/matching/requests/", input);
    return res.data.data;
  },
  async close(id: string, fulfilled = false): Promise<SourcingRequest> {
    const res = await apiClient.post(`/matching/requests/${id}/close/`, { fulfilled });
    return res.data.data;
  },
  /** Catalog rolls that already fit the request (buyer only). */
  async matches(id: string): Promise<FabricRollListItem[]> {
    const res = await apiClient.get(`/matching/requests/${id}/matches/`);
    return res.data.data;
  },
};
