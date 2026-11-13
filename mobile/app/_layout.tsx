import "@/i18n";

import {
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
  useFonts,
} from "@expo-google-fonts/hind-siliguri";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/queryClient";
import { useAuth } from "@/store/auth";
import { fonts, useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// Refetch stale queries when the app returns to the foreground.
function useAppFocusRefetch() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const { colors, dark } = useTheme();
  const { t } = useTranslation();
  useAppFocusRefetch();

  const [fontsLoaded, fontError] = useFonts({
    HindSiliguri_400Regular,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
  });
  // A font failure shouldn't brick the app; it falls back to the system font.
  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== "loading" && fontsReady) void SplashScreen.hideAsync();
  }, [status, fontsReady]);

  // Keep the splash screen up until we know who the user is and the typeface is ready.
  if (status === "loading" || !fontsReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={dark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.semibold },
            contentStyle: { backgroundColor: colors.background },
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="buyer" options={{ headerShown: false }} />
          <Stack.Screen name="factory" options={{ headerShown: false }} />
          <Stack.Screen name="hub" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="roll/[id]" options={{ title: t("roll.title") }} />
          <Stack.Screen name="mill/[id]" options={{ title: t("mill.title") }} />
          <Stack.Screen name="order/[id]" options={{ title: t("orders.detailTitle") }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
