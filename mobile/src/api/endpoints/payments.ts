import { apiClient } from "../client";
import type { PaymentAccounts, PaymentSubmission, PaymentSubmitInput, SubmissionStatus } from "../types";
import { type PickedImage, uploadImageFile } from "../upload";

export const paymentsApi = {
  /** Payment screenshot / bank slip; only this buyer and admins can open it. */
  uploadReceipt(photo: PickedImage): Promise<{ id: string }> {
    return uploadImageFile<{ id: string }>("/payments/receipts/", photo);
  },
  /** FabriLink's bKash / Nagad numbers and bank details. */
  async accounts(): Promise<PaymentAccounts> {
    const res = await apiClient.get("/payments/accounts/");
    return res.data.data;
  },
  async forOrder(orderId: string): Promise<PaymentSubmission[]> {
    const res = await apiClient.get(`/payments/orders/${orderId}/`);
    return res.data.data;
  },
  async submit(orderId: string, input: PaymentSubmitInput): Promise<PaymentSubmission> {
    const res = await apiClient.post(`/payments/orders/${orderId}/`, input);
    return res.data.data;
  },
  /** Admin: mark paid from a TrxID received by phone/SMS, or from an older app version. */
  async record(orderId: string, transactionId: string, note?: string): Promise<PaymentSubmission> {
    const res = await apiClient.post(`/payments/orders/${orderId}/record/`, { transaction_id: transactionId, note });
    return res.data.data;
  },
  /** Admin review queue. */
  async queue(status?: SubmissionStatus): Promise<PaymentSubmission[]> {
    const res = await apiClient.get("/payments/submissions/", { params: status ? { status } : undefined });
    return res.data.data;
  },
  async review(id: string, action: "VERIFY" | "REJECT", note?: string): Promise<PaymentSubmission> {
    const res = await apiClient.post(`/payments/submissions/${id}/review/`, { action, note });
    return res.data.data;
  },
};
