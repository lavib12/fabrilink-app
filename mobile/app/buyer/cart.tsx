import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";

import type { CartItem, Fees, PaymentMethod } from "@/api/types";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { Button, Card, ColorDot, EmptyState, ErrorState, ListSkeleton, Row, Sheet, Text, TextField } from "@/components/ui";
import { YardPicker } from "@/components/YardPicker";
import { useAddToCart, useCart, useCheckout, useRemoveCartItem } from "@/hooks/queries";
import { checkBreakdown } from "@/lib/breakdown";
import { formatBDT, formatNumber, toNumber } from "@/lib/format";
import { showPurchaseError } from "@/lib/purchaseErrors";
import { needsKyc } from "@/lib/routing";
import { useAuth } from "@/store/auth";
import { MIN_TOUCH, spacing, useTheme } from "@/theme";

export default function CartScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const cart = useCart();
  const remove = useRemoveCartItem();
  const checkout = useCheckout();
  const [payment, setPayment] = useState<PaymentMethod>("BKASH");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<CartItem | null>(null);

  if (cart.isPending) return <ListSkeleton rows={3} />;
  if (cart.isError) return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;

  const items = cart.data.items;
  // The server returns `{}` for fees when the cart is empty.
  const fees: Fees | null = "total_amount" in cart.data.fees ? (cart.data.fees as Fees) : null;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="cart-outline"
        title={t("cart.emptyTitle")}
        message={t("cart.emptyMessage")}
        actionLabel={t("cart.browse")}
        onAction={() => router.navigate("/buyer")}
      />
    );
  }

  const confirmRemove = (item: CartItem) =>
    Alert.alert(t("cart.removeTitle"), item.roll_title, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("cart.remove"), style: "destructive", onPress: () => remove.mutate(item.id) },
    ]);

  const onCheckout = async () => {
    if (needsKyc(user)) {
      router.push("/pending-approval");
      return;
    }
    try {
      const order = await checkout.mutateAsync({
        payment_method: payment,
        delivery_notes: notes.trim() || undefined,
      });
      router.push({ pathname: "/order/[id]", params: { id: order.id } });
    } catch (err) {
      showPurchaseError(err, t);
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={cart.isRefetching} onRefresh={() => void cart.refetch()} />}
        keyboardShouldPersistTaps="handled"
      >
        {needsKyc(user) ? (
          <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning }}>
            <Text color={colors.warning} variant="label">
              {t("cart.kycNeeded")}
            </Text>
          </Card>
        ) : null}

        {items.map((item) => (
          <Card key={item.id} style={{ gap: spacing.sm }}>
            <Row style={{ alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" numberOfLines={2}>
                  {item.roll_title}
                </Text>
                <Row style={{ gap: 6 }}>
                  <ColorDot hex={item.roll_color_hex} />
                  <Text variant="caption" muted numeric>
                    {t("catalog.specLineShort", { color: item.roll_color_name, gsm: item.roll_gsm })}
                  </Text>
                </Row>
                <Row>
                  <Text variant="caption" muted>
                    {item.roll_code}
                  </Text>
                </Row>
              </View>
              <Pressable
                onPress={() => confirmRemove(item)}
                accessibilityRole="button"
                accessibilityLabel={t("cart.removeItem", { title: item.roll_title })}
                style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Text muted>
                {formatNumber(item.requested_yards)} {t("common.yd")} × {formatBDT(item.unit_price)}
              </Text>
              <Text variant="label">{formatBDT(item.item_subtotal, 2)}</Text>
            </Row>
            <Button title={t("cart.editYards")} variant="secondary" small onPress={() => setEditing(item)} />
          </Card>
        ))}

        <Card style={{ gap: spacing.md }}>
          <Text variant="subheading">{t("cart.summary")}</Text>
          {fees ? <FeeBreakdown fees={fees} /> : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="subheading">{t("checkout.paymentMethod")}</Text>
          <PaymentMethodPicker value={payment} onChange={setPayment} />
          <TextField label={t("checkout.deliveryNotes")} value={notes} onChangeText={setNotes} multiline />
        </Card>

        <Button
          title={fees ? t("checkout.placeOrder", { total: formatBDT(fees.total_amount, 2) }) : t("checkout.checkout")}
          onPress={() => void onCheckout()}
          loading={checkout.isPending}
        />
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {editing ? <EditYardsSheet item={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function EditYardsSheet({ item, onClose }: { item: CartItem; onClose: () => void }) {
  const { t } = useTranslation();
  const add = useAddToCart();
  const available = toNumber(item.roll_available_yards);
  const minCut = toNumber(item.roll_min_cut);
  const [yards, setYards] = useState(toNumber(item.requested_yards));
  const valid = checkBreakdown(yards, available, minCut).valid;

  const save = async () => {
    try {
      // Re-adding the same roll replaces its yardage on the server.
      await add.mutateAsync({ rollId: item.fabric_roll, yards });
      onClose();
    } catch (err) {
      showPurchaseError(err, t);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={item.roll_title}
      footer={<Button title={t("common.save")} onPress={() => void save()} loading={add.isPending} disabled={!valid} />}
    >
      <YardPicker value={yards} onChange={setYards} available={available} minCut={minCut} />
    </Sheet>
  );
}
