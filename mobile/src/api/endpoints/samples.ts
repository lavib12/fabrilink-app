import { apiClient } from "../client";
import type { SampleRequest, SampleRequestInput, SampleStatus } from "../types";

export const samplesApi = {
  /** Buyers: samples they asked for. Factories: requests for their rolls. Admins: all. */
  async list(params: { status?: SampleStatus; roll?: string } = {}): Promise<SampleRequest[]> {
    const res = await apiClient.get("/samples/requests/", { params });
    return res.data.data;
  },
  async create(input: SampleRequestInput): Promise<SampleRequest> {
    const res = await apiClient.post("/samples/requests/", input);
    return res.data.data;
  },
  async setStatus(id: string, status: SampleStatus, note?: string): Promise<SampleRequest> {
    const res = await apiClient.post(`/samples/requests/${id}/status/`, { status, note });
    return res.data.data;
  },
};
