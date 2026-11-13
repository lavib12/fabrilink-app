import { apiClient } from "../client";
import type { Cart, CartItem, CreditSummary, Order, OrderStatus, PaymentMethod } from "../types";

export interface CheckoutInput {
  payment_method: PaymentMethod;
  delivery_notes?: string;
  /** Check out only these cart items (e.g. "Buy now"); omit for the whole cart. */
  item_ids?: string[];
}

export const ordersApi = {
  async cart(): Promise<Cart> {
    const res = await apiClient.get("/orders/cart/");
    return res.data.data;
  },
  async addToCart(fabricRollId: string, requestedYards: number): Promise<CartItem> {
    const res = await apiClient.post("/orders/cart/items/", {
      fabric_roll_id: fabricRollId,
      requested_yards: requestedYards.toFixed(2),
    });
    return res.data.data;
  },
  async removeCartItem(itemId: string): Promise<void> {
    await apiClient.delete(`/orders/cart/items/${itemId}/`);
  },
  async checkout(input: CheckoutInput): Promise<Order> {
    const res = await apiClient.post("/orders/checkout/", input);
    return res.data.data;
  },
  async credit(): Promise<CreditSummary> {
    const res = await apiClient.get("/orders/credit/");
    return res.data.data;
  },
  async list(status?: OrderStatus): Promise<Order[]> {
    const res = await apiClient.get("/orders/", { params: status ? { status } : undefined });
    return res.data.data;
  },
  async detail(id: string): Promise<Order> {
    const res = await apiClient.get(`/orders/${id}/`);
    return res.data.data;
  },
  async updateStatus(
    id: string,
    status: OrderStatus,
    notes?: string,
    location?: string
  ): Promise<Order> {
    const res = await apiClient.patch(`/orders/${id}/status/`, { status, notes, location });
    return res.data.data;
  },
};
