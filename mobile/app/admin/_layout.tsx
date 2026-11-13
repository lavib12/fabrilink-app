import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { RoleGate } from "@/components/RoleGate";
import { tabIcon, useTabScreenOptions } from "@/components/tabOptions";

export default function AdminLayout() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  return (
    <RoleGate roles={["ADMIN"]}>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="index" options={{ title: t("tabs.kyc"), tabBarIcon: tabIcon("shield-checkmark-outline", "shield-checkmark") }} />
        <Tabs.Screen name="orders" options={{ title: t("tabs.allOrders"), tabBarIcon: tabIcon("receipt-outline", "receipt") }} />
        <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person-circle-outline", "person-circle") }} />
      </Tabs>
    </RoleGate>
  );
}
