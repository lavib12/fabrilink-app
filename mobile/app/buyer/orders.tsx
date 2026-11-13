import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { OrderList } from "@/components/orders";

export default function BuyerOrdersScreen() {
  const { t } = useTranslation();
  return (
    <OrderList
      filters={["ALL", "PAID_CREDIT_APPROVED", "AT_HUB", "CUTTING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]}
      emptyTitle={t("orders.emptyBuyerTitle")}
      emptyMessage={t("orders.emptyBuyerMessage")}
      emptyActionLabel={t("cart.browse")}
      onEmptyAction={() => router.navigate("/buyer")}
    />
  );
}
