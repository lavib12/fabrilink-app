import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { fonts, useTheme } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function tabIcon(name: IconName, focusedName?: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused && focusedName ? focusedName : name} size={size} color={color as string} />;
  };
}

/** Shared Tabs screenOptions so every role's tab bar looks the same. */
export function useTabScreenOptions() {
  const { colors } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { fontFamily: fonts.semibold },
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    sceneStyle: { backgroundColor: colors.background },
  };
}
