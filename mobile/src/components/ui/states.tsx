import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Animated, StyleSheet, View, type ViewStyle } from "react-native";

import { getErrorMessage, isNetworkError } from "@/api/errors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { radius, spacing, useTheme } from "@/theme";

import { Button, Text } from "./primitives";

export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text muted>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text variant="subheading" center>
        {title}
      </Text>
      {message ? (
        <Text muted center>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} fullWidth={false} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const offline = isNetworkError(error);
  return (
    <View style={styles.center}>
      <Ionicons
        name={offline ? "cloud-offline-outline" : "alert-circle-outline"}
        size={48}
        color={offline ? colors.warning : colors.danger}
      />
      <Text variant="subheading" center>
        {offline ? t("common.offlineTitle") : t("common.errorTitle")}
      </Text>
      <Text muted center>
        {getErrorMessage(error)}
      </Text>
      {onRetry ? (
        <Button title={t("common.retry")} onPress={onRetry} fullWidth={false} variant="secondary" />
      ) : null}
    </View>
  );
}

/** Pulsing placeholder block. */
export function Skeleton({ height = 16, width, style }: { height?: number; width?: ViewStyle["width"]; style?: ViewStyle }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    // Respect the system "Reduce Motion" setting: show a static placeholder.
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return (
    <Animated.View
      style={[
        { height, width: width ?? "100%", borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, opacity },
        style,
      ]}
    />
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid} accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.gridCell}>
          <Skeleton height={120} />
          <Skeleton height={14} width="80%" />
          <Skeleton height={12} width="50%" />
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <Skeleton height={18} width="60%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="40%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
    minHeight: 280,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.md, gap: spacing.md },
  gridCell: { width: "47%", gap: spacing.sm },
});
