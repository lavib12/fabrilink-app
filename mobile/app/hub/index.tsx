import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";

import type { Order, OrderStatus } from "@/api/types";
import { OrderStatusSheet } from "@/components/OrderStatusSheet";
import { OrderCard } from "@/components/orders";
import { Button, Chip, EmptyState, ErrorState, ListSkeleton } from "@/components/ui";
import { useOrders } from "@/hooks/queries";
import { nextPipelineStatus } from "@/lib/orderStatus";
import { spacing } from "@/theme";

type Lane = "incoming" | "atHub" | "cutting" | "packed" | "dispatched" | "all";

const LANES: Record<Lane, OrderStatus[] | null> = {
  incoming: ["PAID_CREDIT_APPROVED", "PICKUP_SCHEDULED", "PICKED_UP"],
  atHub: ["AT_HUB"],
  cutting: ["CUTTING", "CUT_DONE"],
  packed: ["PACKED"],
  dispatched: ["OUT_FOR_DELIVERY"],
  all: null,
};

export default function HubQueueScreen() {
  const { t } = useTranslation();
  const orders = useOrders();
  const [lane, setLane] = useState<Lane>("incoming");
  const [acting, setActing] = useState<{ order: Order; status: OrderStatus } | null>(null);

  const byLane = useMemo(() => {
    const all = orders.data ?? [];
    const out = {} as Record<Lane, Order[]>;
    for (const key of Object.keys(LANES) as Lane[]) {
      const statuses = LANES[key];
      // Oldest first: the hub works the queue in arrival order.
      out[key] = (statuses ? all.filter((o) => statuses.includes(o.status)) : all)
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return out;
  }, [orders.data]);

  return (
    <>
      <FlatList
        data={byLane[lane]}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {(Object.keys(LANES) as Lane[]).map((l) => (
              <Chip key={l} label={`${t(`hub.lanes.${l}`)} (${byLane[l].length})`} selected={lane === l} onPress={() => setLane(l)} />
            ))}
          </ScrollView>
        }
        renderItem={({ item }) => {
          const next = nextPipelineStatus(item.status);
          return (
            <View style={{ gap: spacing.sm }}>
              <OrderCard order={item} showBuyer />
              {next && lane !== "all" ? (
                <Button
                  small
                  title={t("orderActions.moveTo", { status: t(`orderStatus.${next}`) })}
                  onPress={() => setActing({ order: item, status: next })}
                />
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          orders.isPending ? (
            <ListSkeleton />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : (
            <EmptyState icon="checkmark-done-outline" title={t("hub.emptyLane")} />
          )
        }
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />}
      />
      {acting ? (
        <OrderStatusSheet order={acting.order} visible initialStatus={acting.status} onClose={() => setActing(null)} />
      ) : null}
    </>
  );
}
