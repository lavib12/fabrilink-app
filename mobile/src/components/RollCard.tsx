import { Image } from "expo-image";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import type { FabricRollListItem } from "@/api/types";
import { formatBDT, formatNumber } from "@/lib/format";
import { radius, spacing, useTheme } from "@/theme";

import { Badge, PressableCard, Row, Text } from "./ui";

export const FALLBACK_FABRIC_IMAGE =
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=70";

export function RollCard({ roll, showStatus = false }: { roll: FabricRollListItem; showStatus?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <PressableCard
      onPress={() => router.push({ pathname: "/roll/[id]", params: { id: roll.id } })}
      accessibilityLabel={`${roll.title}, ${roll.mill_name}, ${formatBDT(roll.price_per_yard)} ${t("common.perYard")}`}
      style={styles.card}
    >
      <View>
        <Image
          source={{ uri: roll.primary_image ?? FALLBACK_FABRIC_IMAGE }}
          style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
        {roll.is_custom_profile ? (
          <View style={styles.badgeOverlay}>
            <Badge label={t("catalog.exclusive")} tone="exclusive" />
          </View>
        ) : null}
      </View>
      {/* Swatch-book tab in the fabric's real colour. */}
      <View
        style={[styles.swatch, { backgroundColor: roll.color_hex, borderColor: colors.border }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.body}>
        <Text variant="label" numberOfLines={2}>
          {roll.title}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {roll.mill_name}
        </Text>
        <Text variant="caption" muted numberOfLines={1} numeric>
          {t("catalog.specLine", {
            color: roll.color_name,
            gsm: roll.gsm,
            width: formatNumber(roll.width_inches),
          })}
        </Text>
        <Row style={{ justifyContent: "space-between", marginTop: 2, alignItems: "baseline" }}>
          <Text variant="label" color={colors.primary} numeric>
            {formatBDT(roll.price_per_yard)}
            <Text variant="caption" muted>
              /{t("common.yd")}
            </Text>
          </Text>
          <Text variant="caption" muted numeric>
            {t("catalog.yardsLeft", { yards: formatNumber(roll.available_yards, 0) })}
          </Text>
        </Row>
        {showStatus ? <Badge label={t(`rollStatus.${roll.status}`)} tone={roll.status === "SOLD_OUT" ? "danger" : "neutral"} /> : null}
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: "hidden", flex: 1 },
  image: { width: "100%", aspectRatio: 4 / 3, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  swatch: { height: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  badgeOverlay: { position: "absolute", top: spacing.sm, left: spacing.sm },
  body: { padding: spacing.md, gap: 4 },
});
