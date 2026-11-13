import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { RoleGate } from "@/components/RoleGate";
import { tabIcon, useTabScreenOptions } from "@/components/tabOptions";

export default function FactoryLayout() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  return (
    <RoleGate roles={["FACTORY"]} requireKyc>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="index" options={{ title: t("tabs.dashboard"), tabBarIcon: tabIcon("speedometer-outline", "speedometer") }} />
        <Tabs.Screen name="stock" options={{ title: t("tabs.stock"), tabBarIcon: tabIcon("layers-outline", "layers") }} />
        <Tabs.Screen name="new-listing" options={{ title: t("tabs.newListing"), tabBarIcon: tabIcon("add-circle-outline", "add-circle") }} />
        <Tabs.Screen name="orders" options={{ title: t("tabs.orders"), tabBarIcon: tabIcon("receipt-outline", "receipt") }} />
        <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person-circle-outline", "person-circle") }} />
      </Tabs>
    </RoleGate>
  );
}
