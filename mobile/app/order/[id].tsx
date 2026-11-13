import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, View } from "react-native";

import type { OrderStatus } from "@/api/types";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { OrderStatusSheet } from "@/components/OrderStatusSheet";
import { OrderTimeline, StatusBadge } from "@/components/orders";
import { Button, Card, Divider, ErrorState, KeyValue, LoadingState, Row, Text } from "@/components/ui";
import { useOrder } from "@/hooks/queries";
import { formatBDT, formatDateTime, formatNumber } from "@/lib/format";
import { canBuyerCancel, nextPipelineStatus } from "@/lib/orderStatus";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const order = useOrder(id);
  const [sheet, setSheet] = useState<{ status?: OrderStatus; only?: OrderStatus[] } | null>(null);

  if (order.isPending) return <LoadingState />;
  if (order.isError || !order.data) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;

  const o = order.data;
  const isOps = user?.role === "HUB_STAFF" || user?.role === "ADMIN";
  const isBuyer = user?.role === "BUYER";
  const next = nextPipelineStatus(o.status);

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} />}
      >
        <Card style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="subheading">{o.order_number}</Text>
            <StatusBadge status={o.status} />
          </Row>
          <Text>{o.buyer_name}</Text>
          <Text muted>{formatDateTime(o.created_at)}</Text>
          <Text muted>
            {t("orders.paidWith")}: {t(`payment.${o.payment_method}`, { defaultValue: o.payment_method })}
          </Text>
          {o.delivery_notes ? <Text>{o.delivery_notes}</Text> : null}
          {o.cancellation_reason ? (
            <Text color={colors.danger}>
              {t("orders.cancelReason")}: {o.cancellation_reason}
            </Text>
          ) : null}
        </Card>

        {isOps && (next || o.status === "DELIVERED" || o.status === "DISPUTED") ? (
          <Card style={{ gap: spacing.sm }}>
            {next ? (
              <Button
                title={t("orderActions.moveTo", { status: t(`orderStatus.${next}`) })}
                onPress={() => setSheet({ status: next })}
              />
            ) : null}
            <Button title={t("orderActions.moreActions")} variant="secondary" onPress={() => setSheet({})} />
          </Card>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          <Text variant="subheading">{t("orders.items")}</Text>
          {o.items.map((item, i) => (
            <View key={item.id} style={{ gap: 2 }}>
              {i > 0 ? <Divider /> : null}
              <Text variant="label">{item.roll_title}</Text>
              <Text variant="caption" muted>
                {t("orders.itemMeta", { code: item.roll_code, color: item.color_name })}
              </Text>
              <Row style={{ justifyContent: "space-between" }}>
                <Text muted>
                  {formatNumber(item.requested_yards)} {t("common.yd")} × {formatBDT(item.unit_price)}
                </Text>
                <Text variant="label">{formatBDT(item.subtotal, 2)}</Text>
              </Row>
            </View>
          ))}
        </Card>

        {/* Factories only see their own line items, so the order-level fees don't apply to them. */}
        {user?.role !== "FACTORY" ? (
          <Card>
            <FeeBreakdown fees={o} />
          </Card>
        ) : (
          <Card>
            <KeyValue
              label={t("orders.yourItemsTotal")}
              value={formatBDT(o.items.reduce((s, i) => s + Number(i.subtotal), 0), 2)}
              bold
            />
          </Card>
        )}

        <Card style={{ gap: spacing.md }}>
          <Text variant="subheading">{t("orders.tracking")}</Text>
          <OrderTimeline events={o.tracking_events} />
        </Card>

        {isBuyer && canBuyerCancel(o.status) ? (
          <Button
            title={t("orderActions.cancelOrder", { status: "" })}
            variant="ghost"
            onPress={() => setSheet({ status: "CANCELLED", only: ["CANCELLED"] })}
          />
        ) : null}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {sheet ? (
        <OrderStatusSheet
          order={o}
          visible
          onClose={() => setSheet(null)}
          initialStatus={sheet.status}
          only={sheet.only}
        />
      ) : null}
    </>
  );
}
