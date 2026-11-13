import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import type { Order, OrderStatus, TrackingEvent } from "@/api/types";
import { useOrders } from "@/hooks/queries";
import { formatBDT, formatDate, formatDateTime, formatNumber, toNumber } from "@/lib/format";
import { pipelineProgress, statusTone } from "@/lib/orderStatus";
import { radius, spacing, useTheme } from "@/theme";

import { Badge, Chip, EmptyState, ErrorState, ListSkeleton, PressableCard, Row, Text } from "./ui";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <Badge label={t(`orderStatus.${status}`)} tone={statusTone(status)} />;
}

export function OrderCard({ order, showBuyer = false }: { order: Order; showBuyer?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const yards = order.items.reduce((s, i) => s + toNumber(i.requested_yards), 0);
  const progress = pipelineProgress(order.status);
  return (
    <PressableCard
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
      accessibilityLabel={`${order.order_number}, ${t(`orderStatus.${order.status}`)}`}
      style={{ gap: spacing.sm }}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="label">{order.order_number}</Text>
        <StatusBadge status={order.status} />
      </Row>
      {showBuyer ? (
        <Text variant="caption" muted>
          {order.buyer_name}
        </Text>
      ) : null}
      <Text muted numberOfLines={1}>
        {order.items.map((i) => i.roll_title).join(", ") || "—"}
      </Text>
      {progress > 0 ? (
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
        </View>
      ) : null}
      <Row style={{ justifyContent: "space-between" }}>
        <View>
          <Text variant="caption" muted>
            {formatDate(order.created_at)}
          </Text>
          <Text variant="caption" muted numeric>
            {formatNumber(yards)} {t("common.yd")}
          </Text>
        </View>
        <Text variant="label" numeric>
          {formatBDT(order.total_amount)}
        </Text>
      </Row>
    </PressableCard>
  );
}

export function OrderTimeline({ events }: { events: TrackingEvent[] }) {
  const { colors } = useTheme();
  // Newest first.
  const sorted = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <View>
      {sorted.map((e, i) => {
        const isLatest = i === 0;
        const isLast = i === sorted.length - 1;
        return (
          <Row key={e.id} style={{ alignItems: "stretch", gap: spacing.md }}>
            <View style={{ alignItems: "center", width: 20 }}>
              <View
                style={[
                  styles.node,
                  { backgroundColor: isLatest ? colors.primary : colors.surface, borderColor: colors.primary },
                ]}
              />
              {!isLast ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing.lg, gap: 2 }}>
              <Text variant="label" color={isLatest ? colors.primary : colors.text}>
                {e.title}
              </Text>
              {e.description ? <Text muted>{e.description}</Text> : null}
              {e.location ? (
                <Row style={{ gap: 4 }}>
                  <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                  <Text variant="caption" muted style={{ flexShrink: 1 }}>
                    {e.location}
                  </Text>
                </Row>
              ) : null}
              <Text variant="caption" muted>
                {formatDateTime(e.created_at)}
              </Text>
            </View>
          </Row>
        );
      })}
    </View>
  );
}

/** Orders list with status filter chips; scope is decided by the server per role. */
export function OrderList({
  filters,
  showBuyer = false,
  emptyTitle,
  emptyMessage,
  onEmptyAction,
  emptyActionLabel,
}: {
  filters: (OrderStatus | "ALL")[];
  showBuyer?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const orders = useOrders(status === "ALL" ? undefined : status);

  return (
    <FlatList
      data={orders.data ?? []}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
      ListHeaderComponent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {filters.map((f) => (
            <Chip key={f} label={f === "ALL" ? t("orders.all") : t(`orderStatus.${f}`)} selected={status === f} onPress={() => setStatus(f)} />
          ))}
        </ScrollView>
      }
      renderItem={({ item }) => <OrderCard order={item} showBuyer={showBuyer} />}
      ListEmptyComponent={
        orders.isPending ? (
          <ListSkeleton />
        ) : orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : (
          <EmptyState
            icon="receipt-outline"
            title={emptyTitle ?? t("orders.emptyTitle")}
            message={emptyMessage}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        )
      }
      refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />}
    />
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 3 },
  line: { width: 2, flex: 1, marginTop: 2 },
});
