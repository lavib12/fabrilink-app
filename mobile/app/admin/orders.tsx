import { OrderList } from "@/components/orders";

export default function AdminOrdersScreen() {
  return (
    <OrderList
      showBuyer
      filters={[
        "ALL",
        "PAID_CREDIT_APPROVED",
        "AT_HUB",
        "CUTTING",
        "PACKED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "COMPLETED",
        "DISPUTED",
        "CANCELLED",
        "REFUNDED",
      ]}
    />
  );
}
