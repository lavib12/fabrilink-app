import { useTranslation } from "react-i18next";

import { OrderList } from "@/components/orders";

export default function FactoryOrdersScreen() {
  const { t } = useTranslation();
  return (
    <OrderList
      showBuyer
      filters={["ALL", "PAID_CREDIT_APPROVED", "PICKUP_SCHEDULED", "PICKED_UP", "AT_HUB", "DELIVERED", "COMPLETED", "CANCELLED"]}
      emptyTitle={t("factory.noOrders")}
    />
  );
}
