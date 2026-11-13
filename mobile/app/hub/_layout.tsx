import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { RoleGate } from "@/components/RoleGate";
import { tabIcon, useTabScreenOptions } from "@/components/tabOptions";

export default function HubLayout() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  return (
    <RoleGate roles={["HUB_STAFF"]}>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="index" options={{ title: t("tabs.queue"), tabBarIcon: tabIcon("cut-outline", "cut") }} />
        <Tabs.Screen name="scan" options={{ title: t("tabs.scan"), tabBarIcon: tabIcon("barcode-outline", "barcode") }} />
        <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person-circle-outline", "person-circle") }} />
      </Tabs>
    </RoleGate>
  );
}
