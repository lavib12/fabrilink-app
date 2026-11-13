import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { RoleGate } from "@/components/RoleGate";
import { tabIcon, useTabScreenOptions } from "@/components/tabOptions";
import { useCart } from "@/hooks/queries";
import { useAuth } from "@/store/auth";

export default function BuyerLayout() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  const signedIn = useAuth((s) => s.status === "authenticated");
  const cart = useCart();
  const cartCount = cart.data?.items.length ?? 0;

  return (
    <RoleGate roles={["BUYER"]} allowAnonymous>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{ title: t("tabs.catalog"), tabBarIcon: tabIcon("grid-outline", "grid") }}
        />
        <Tabs.Screen
          name="exclusive"
          options={{
            title: t("tabs.exclusive"),
            tabBarIcon: tabIcon("sparkles-outline", "sparkles"),
            href: signedIn ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: t("tabs.cart"),
            tabBarIcon: tabIcon("cart-outline", "cart"),
            tabBarBadge: cartCount > 0 ? cartCount : undefined,
            href: signedIn ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: t("tabs.orders"),
            tabBarIcon: tabIcon("receipt-outline", "receipt"),
            href: signedIn ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: signedIn ? t("tabs.profile") : t("tabs.signIn"),
            tabBarIcon: tabIcon("person-circle-outline", "person-circle"),
          }}
        />
      </Tabs>
    </RoleGate>
  );
}
