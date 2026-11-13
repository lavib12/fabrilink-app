import { Redirect, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { Badge, Card, ErrorState, KeyValue, LoadingState, Text } from "@/components/ui";
import { useCredit } from "@/hooks/queries";
import { formatBDT, toNumber } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { radius, spacing, useTheme } from "@/theme";

export default function CreditScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const credit = useCredit();

  if (!user) return <Redirect href="/login" />;
  if (user.role !== "BUYER") return <Redirect href="/" />;
  if (credit.isPending) return <LoadingState />;
  if (credit.isError) return <ErrorState error={credit.error} onRetry={() => void credit.refetch()} />;

  const c = credit.data;
  const limit = toNumber(c.credit_limit);
  const used = toNumber(c.outstanding);
  const usedShare = limit > 0 ? Math.min(1, used / limit) : 0;

  return (
    <>
      <Stack.Screen options={{ title: t("credit.title") }} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={credit.isRefetching} onRefresh={() => void credit.refetch()} />}
      >
        {limit <= 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="subheading">{t("credit.noneTitle")}</Text>
            <Text muted>{t("credit.noneBody")}</Text>
          </Card>
        ) : (
          <Card style={{ gap: spacing.md }}>
            <View style={{ gap: 2 }}>
              <Text muted>{t("credit.available")}</Text>
              <Text variant="title" color={colors.primary} numeric>
                {formatBDT(c.available)}
              </Text>
            </View>
            <View
              style={[styles.meter, { backgroundColor: colors.surfaceMuted }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t("credit.meterLabel", { used: formatBDT(used), limit: formatBDT(limit) })}
            >
              <View style={[styles.fill, { width: `${usedShare * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            <KeyValue label={t("credit.limit")} value={formatBDT(limit)} />
            <KeyValue label={t("credit.outstanding")} value={formatBDT(used)} />
            <KeyValue label={t("credit.terms")} value={t("credit.termsValue", { days: c.credit_terms_days || 30 })} />
            <Badge
              label={c.can_use_credit ? t("credit.active") : t("credit.limitReached")}
              tone={c.can_use_credit ? "success" : "warning"}
            />
          </Card>
        )}
        <Card style={{ gap: spacing.sm }}>
          <Text variant="label">{t("credit.howTitle")}</Text>
          <Text muted>{t("credit.howBody")}</Text>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  meter: { height: 10, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 10, borderRadius: radius.pill },
});
