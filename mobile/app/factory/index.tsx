import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, View } from "react-native";

import { StatusBadge } from "@/components/orders";
import { Button, Card, Divider, ErrorState, KeyValue, ListSkeleton, PressableCard, Row, Text } from "@/components/ui";
import { useOrders, useRolls, useSourcingRequests } from "@/hooks/queries";
import { computeFactoryKpis } from "@/lib/factoryStats";
import { formatBDT, formatNumber } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

const MINE = { mine: true } as const;

export default function FactoryDashboard() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const { colors } = useTheme();
  const rolls = useRolls(MINE);
  const orders = useOrders();
  const requests = useSourcingRequests("OPEN");

  const refreshing = rolls.isRefetching || orders.isRefetching;
  const refresh = () => {
    void rolls.refetch();
    void orders.refetch();
  };

  if (rolls.isPending || orders.isPending) return <ListSkeleton rows={4} />;
  if (rolls.isError) return <ErrorState error={rolls.error} onRetry={refresh} />;
  if (orders.isError) return <ErrorState error={orders.error} onRetry={refresh} />;

  const k = computeFactoryKpis(rolls.data, orders.data);
  const pickups = orders.data.filter((o) => o.status === "PAID_CREDIT_APPROVED" || o.status === "PICKUP_SCHEDULED");
  const openRequests = requests.data?.length ?? 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={{ gap: 2, paddingHorizontal: spacing.xs }}>
        <Text muted>{t("factory.welcome")}</Text>
        <Text variant="heading">{user?.company?.name}</Text>
      </View>

      <Row style={{ gap: spacing.md }}>
        <Kpi icon="layers" label={t("factory.yardsListed")} value={formatNumber(k.yardsListed, 0)} sub={t("factory.rollsCount", { count: k.activeRolls })} />
        <Kpi icon="cube" label={t("factory.awaitingPickup")} value={String(k.awaitingPickup)} sub={t("factory.orders")} />
      </Row>
      <Row style={{ gap: spacing.md }}>
        <Kpi icon="trending-up" label={t("factory.grossRevenue")} value={formatBDT(k.grossRevenue)} sub={t("factory.excludesCancelled")} />
        <Kpi icon="wallet" label={t("factory.netPayout")} value={formatBDT(k.netPayout)} sub={t("factory.afterCommission")} />
      </Row>

      <Button
        title={t("factory.newListing")}
        icon={<Ionicons name="add" size={20} color={colors.primaryText} />}
        onPress={() => router.navigate("/factory/new-listing")}
      />

      {openRequests > 0 ? (
        <PressableCard
          onPress={() => router.push("/requests")}
          style={{ backgroundColor: colors.exclusiveSoft, borderColor: colors.exclusive, gap: 4 }}
          accessibilityLabel={t("factory.requestsTeaser", { count: openRequests })}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="label" color={colors.exclusive} style={{ flex: 1 }}>
              {t("factory.requestsTeaser", { count: openRequests })}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.exclusive} />
          </Row>
          <Text variant="caption" muted>
            {t("factory.requestsTeaserBody")}
          </Text>
        </PressableCard>
      ) : null}

      {/* Pickups — what the hub van collects next, as on the web "Pickup schedules" tab. */}
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <Text variant="subheading">{t("factory.pickupsTitle")}</Text>
        <Text variant="caption" muted>
          {t("factory.pickupsIntro")}
        </Text>
      </View>
      {pickups.length === 0 ? (
        <Card>
          <Text muted>{t("factory.noPickups")}</Text>
        </Card>
      ) : (
        pickups.map((o) => (
          <PressableCard
            key={o.id}
            onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })}
            style={{ gap: spacing.sm }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="label">{o.order_number}</Text>
              <StatusBadge status={o.status} />
            </Row>
            <Text muted>{o.buyer_name}</Text>
            {o.items.map((i) => (
              <Row key={i.id} style={{ justifyContent: "space-between" }}>
                <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                  {i.roll_title}
                </Text>
                <Text variant="caption" numeric>
                  {formatNumber(i.requested_yards)} {t("common.yd")}
                </Text>
              </Row>
            ))}
          </PressableCard>
        ))
      )}

      {/* Payouts — same breakdown as the web "Payouts & ledger" tab. */}
      <Card style={{ gap: 2, marginTop: spacing.sm }}>
        <Text variant="subheading" style={{ marginBottom: spacing.sm }}>
          {t("factory.payoutsTitle")}
        </Text>
        <KeyValue label={t("factory.grossRevenue")} value={formatBDT(k.grossRevenue)} />
        <KeyValue label={t("factory.commission")} value={`− ${formatBDT(k.grossRevenue - k.netPayout)}`} />
        <Divider />
        <KeyValue label={t("factory.netPayout")} value={formatBDT(k.netPayout)} bold />
        <Text variant="caption" muted style={{ marginTop: spacing.sm }}>
          {t("factory.payoutsNote")}
        </Text>
      </Card>

      <Row style={{ gap: spacing.md }}>
        <Button title={t("factory.allOrders")} variant="secondary" onPress={() => router.navigate("/factory/orders")} style={{ flex: 1 }} />
        {user?.company?.id ? (
          <Button
            title={t("factory.myStorefront")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/mill/[id]", params: { id: user.company!.id } })}
            style={{ flex: 1 }}
          />
        ) : null}
      </Row>
      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  sub: string;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${label}: ${value}. ${sub}`}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="subheading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" muted numberOfLines={1}>
        {sub}
      </Text>
    </Card>
  );
}
