import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { RoleGate } from "@/components/RoleGate";
import { tabIcon, useTabScreenOptions } from "@/components/tabOptions";
import { usePaymentQueue } from "@/hooks/queries";

export default function AdminLayout() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  // New payment proofs waiting for a decision, shown as a badge so admins notice them.
  const waiting = usePaymentQueue("SUBMITTED", { refetchInterval: 60_000 }).data?.length ?? 0;
  return (
    <RoleGate roles={["ADMIN"]}>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="index" options={{ title: t("tabs.kyc"), tabBarIcon: tabIcon("shield-checkmark-outline", "shield-checkmark") }} />
        <Tabs.Screen name="orders" options={{ title: t("tabs.allOrders"), tabBarIcon: tabIcon("receipt-outline", "receipt") }} />
        <Tabs.Screen
          name="payments"
          options={{
            title: t("tabs.payments"),
            tabBarIcon: tabIcon("wallet-outline", "wallet"),
            tabBarBadge: waiting > 0 ? waiting : undefined,
          }}
        />
        <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person-circle-outline", "person-circle") }} />
      </Tabs>
    </RoleGate>
  );
}
