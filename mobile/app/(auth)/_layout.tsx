import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme";

export default function AuthLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="login" options={{ title: "" }} />
      <Stack.Screen name="register" options={{ title: t("auth.registerTitle") }} />
      <Stack.Screen name="pending-approval" options={{ title: t("kyc.title") }} />
    </Stack>
  );
}
