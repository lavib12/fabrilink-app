import { apiClient } from "../client";
import type { BuyerSummary, Company, FactoryStore, Verification } from "../types";

export interface KycUpdate {
  name?: string;
  trade_license_number?: string;
  tin_number?: string;
  bin_number?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface VerifyInput {
  action: "APPROVE" | "REJECT" | "SUSPEND";
  rejection_reason?: string;
  credit_limit?: string;
  credit_terms_days?: number;
}

export const companiesApi = {
  async myCompany(): Promise<Company> {
    const res = await apiClient.get("/companies/my-company/");
    return res.data.data;
  },
  async updateKyc(input: KycUpdate): Promise<Company> {
    const res = await apiClient.patch("/companies/my-company/", input);
    return res.data.data;
  },
  async buyers(): Promise<BuyerSummary[]> {
    const res = await apiClient.get("/companies/buyers/");
    return res.data.data;
  },
  async factories(): Promise<FactoryStore[]> {
    const res = await apiClient.get("/companies/factories/");
    return res.data.data;
  },
  async factory(id: string): Promise<FactoryStore> {
    const res = await apiClient.get(`/companies/factories/${id}/`);
    return res.data.data;
  },
  async kycQueue(status: Verification | "ALL" = "PENDING"): Promise<Company[]> {
    const res = await apiClient.get("/companies/admin/kyc-queue/", { params: { status } });
    return res.data.data;
  },
  async verify(companyId: string, input: VerifyInput): Promise<Company> {
    const res = await apiClient.post(`/companies/admin/${companyId}/verify/`, input);
    return res.data.data;
  },
};
