import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PaymentMethod, SampleStatus, SwatchSize } from "@/api/types";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { FALLBACK_FABRIC_IMAGE } from "@/components/RollCard";
import { Badge, Button, Card, Chip, ColorDot, ErrorState, KeyValue, LoadingState, PressableCard, Row, Sheet, Text, TextField } from "@/components/ui";
import { YardPicker } from "@/components/YardPicker";
import { useAddToCart, useCheckout, useCreateSampleRequest, useGatewayLive, useRoll, useSampleRequests } from "@/hooks/queries";
import { getErrorMessage } from "@/api/errors";
import { checkBreakdown } from "@/lib/breakdown";
import { formatBDT, formatNumber, toNumber } from "@/lib/format";
import { isGatewayMethod, openOnlinePayment } from "@/lib/onlinePayment";
import { estimateFees } from "@/lib/pricing";
import { showPurchaseError } from "@/lib/purchaseErrors";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

export default function RollDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const user = useAuth((s) => s.user);
  const roll = useRoll(id);
  const addToCart = useAddToCart();
  const checkout = useCheckout();
  const gatewayLive = useGatewayLive();

  const [yards, setYards] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("BKASH");
  const [notes, setNotes] = useState("");
  const [sampleOpen, setSampleOpen] = useState(false);

  const isBuyerUser = user?.role === "BUYER";
  const samples = useSampleRequests({ roll: id }, Boolean(id) && isBuyerUser);
  const openSample = samples.data?.find((s) => OPEN_SAMPLE.includes(s.status));

  const data = roll.data;
  const available = toNumber(data?.available_yards);
  const minCut = toNumber(data?.min_cut_length_yards);
  const price = toNumber(data?.price_per_yard);

  // Start the picker at the minimum cut (or the whole roll if that's all that's left).
  useEffect(() => {
    if (data) setYards(Math.min(minCut, available) || available);
  }, [data, minCut, available]);

  const breakdown = checkBreakdown(yards, available, minCut);
  const estimate = useMemo(() => estimateFees([{ yards, pricePerYard: price }]), [yards, price]);

  if (roll.isPending) return <LoadingState />;
  if (roll.isError || !data) return <ErrorState error={roll.error} onRetry={() => void roll.refetch()} />;

  const images = data.images.length ? data.images.map((i) => i.image_url) : [FALLBACK_FABRIC_IMAGE];
  const isBuyer = user?.role === "BUYER";
  const isPurchasable = data.status === "ACTIVE" || data.status === "RESERVED_PARTIAL";

  const handlePurchaseError = (err: unknown) => showPurchaseError(err, t);

  const requireBuyer = () => {
    if (!user) {
      router.push("/login");
      return false;
    }
    return isBuyer;
  };

  const onAddToCart = async () => {
    if (!requireBuyer()) return;
    try {
      await addToCart.mutateAsync({ rollId: data.id, yards });
      setNotice(t("roll.addedToCart", { yards: formatNumber(yards) }));
    } catch (err) {
      handlePurchaseError(err);
    }
  };

  const onBuyNow = async () => {
    try {
      const item = await addToCart.mutateAsync({ rollId: data.id, yards });
      // Check out ONLY this item; anything else in the cart stays there.
      const order = await checkout.mutateAsync({
        payment_method: payment,
        delivery_notes: notes.trim() || `Direct checkout: ${formatNumber(yards)} yd of ${data.roll_code}`,
        item_ids: [item.id],
      });
      setBuyOpen(false);
      router.replace({ pathname: "/order/[id]", params: { id: order.id } });
      // Like Daraz: go straight to the bKash / Nagad / card page.
      if (isGatewayMethod(order.payment_method, gatewayLive)) void openOnlinePayment(order.id, t);
    } catch (err) {
      setBuyOpen(false);
      handlePurchaseError(err);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        {/* Gallery */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={{ uri }}
              style={{ width, height: width * 0.75, backgroundColor: colors.surfaceMuted }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`${data.title} photo ${i + 1} of ${images.length}`}
            />
          ))}
        </ScrollView>
        {images.length > 1 ? (
          <Row style={{ justifyContent: "center", marginTop: spacing.sm }}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === imageIndex ? colors.primary : colors.border }]} />
            ))}
          </Row>
        ) : null}

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {data.is_custom_profile ? (
            <Card style={{ backgroundColor: colors.exclusiveSoft, borderColor: colors.exclusive, gap: 6 }}>
              <Row>
                <Ionicons name="sparkles" size={18} color={colors.exclusive} />
                <Text variant="label" color={colors.exclusive}>
                  {t("roll.exclusiveFor", { buyer: data.target_buyer_name ?? "" })}
                </Text>
              </Row>
              {data.buyer_spec_notes ? <Text>{data.buyer_spec_notes}</Text> : null}
            </Card>
          ) : null}

          <View style={{ gap: 6 }}>
            <Row style={{ flexWrap: "wrap" }}>
              <Badge label={data.category_name} tone="primary" />
              <Badge label={t(`grade.${data.quality_grade}`)} tone="info" />
              {!isPurchasable ? <Badge label={t(`rollStatus.${data.status}`)} tone="danger" /> : null}
            </Row>
            <Text variant="heading">{data.title}</Text>
            <Text muted>{data.roll_code}</Text>
            <Text variant="heading" color={colors.primary}>
              {formatBDT(data.price_per_yard)}
              <Text muted> / {t("common.yd")}</Text>
            </Text>
          </View>

          <PressableCard
            onPress={() => router.push({ pathname: "/mill/[id]", params: { id: data.factory_id } })}
            accessibilityLabel={t("roll.viewMill", { mill: data.mill_name })}
          >
            <Row>
              <Ionicons name="business-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{data.mill_name}</Text>
                <Text variant="caption" muted numberOfLines={2}>
                  {data.mill_location}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Row>
          </PressableCard>

          <Card style={{ gap: 2 }}>
            <Text variant="subheading" style={{ marginBottom: spacing.sm }}>
              {t("roll.specs")}
            </Text>
            <KeyValue label={t("roll.fabricType")} value={data.fabric_type_name} />
            <KeyValue label={t("roll.composition")} value={data.composition} />
            <KeyValue label="GSM" value={String(data.gsm)} />
            <KeyValue label={t("roll.width")} value={`${formatNumber(data.width_inches)}"`} />
            <Row style={{ justifyContent: "space-between", paddingVertical: 3 }}>
              <Text muted>{t("roll.color")}</Text>
              <Row style={{ gap: 6 }}>
                <ColorDot hex={data.color_hex} />
                <Text>{data.color_name}</Text>
              </Row>
            </Row>
            <KeyValue label={t("roll.pattern")} value={data.pattern || "—"} />
            <KeyValue label={t("roll.finish")} value={data.finish || "—"} />
            <KeyValue label={t("roll.available")} value={`${formatNumber(available)} / ${formatNumber(data.total_yards)} ${t("common.yd")}`} />
            <KeyValue label={t("roll.minCut")} value={`${formatNumber(minCut)} ${t("common.yd")}`} />
            {data.lot_batch_number ? <KeyValue label={t("roll.lot")} value={data.lot_batch_number} /> : null}
            {data.defect_notes ? (
              <Text variant="caption" color={colors.warning} style={{ marginTop: spacing.sm }}>
                {t("roll.defects")}: {data.defect_notes}
              </Text>
            ) : null}
          </Card>

          {isPurchasable && (isBuyer || !user) ? (
            <Card style={{ gap: spacing.lg }}>
              <Text variant="subheading">{t("roll.chooseYards")}</Text>
              <YardPicker value={yards} onChange={setYards} available={available} minCut={minCut} />
              <FeeBreakdown fees={estimate} estimate />
            </Card>
          ) : null}

          {data.is_sample_available && (isBuyer || !user) ? (
            <Card style={{ gap: spacing.sm }}>
              <Row>
                <Ionicons name="color-palette-outline" size={22} color={colors.primary} />
                <Text variant="subheading" style={{ flex: 1 }}>
                  {t("roll.requestSample")}
                </Text>
              </Row>
              <Text muted>{t("roll.sampleIntro")}</Text>
              {openSample ? (
                <Row style={{ justifyContent: "space-between" }}>
                  <Badge label={t("roll.sampleOpen", { status: t(`samples.status.${openSample.status}`) })} tone="info" />
                  <Button title={t("roll.viewSamples")} variant="ghost" small fullWidth={false} onPress={() => router.push("/samples")} />
                </Row>
              ) : (
                <Button
                  title={t("roll.requestSample")}
                  variant="secondary"
                  icon={<Ionicons name="cube-outline" size={18} color={colors.text} />}
                  onPress={() => (requireBuyer() ? setSampleOpen(true) : undefined)}
                />
              )}
            </Card>
          ) : null}

          {data.mill_contact_phone ? (
            <Button
              title={t("roll.callMill")}
              variant="secondary"
              icon={<Ionicons name="call-outline" size={18} color={colors.text} />}
              onPress={() => void Linking.openURL(`tel:${data.mill_contact_phone}`)}
            />
          ) : null}
        </View>
      </ScrollView>

      {isPurchasable && (isBuyer || !user) ? (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>
          {notice ? (
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="caption" color={colors.success} style={{ flex: 1, fontWeight: "700" }}>
                {notice}
              </Text>
              <Button title={t("roll.viewCart")} variant="ghost" small fullWidth={false} onPress={() => router.push("/buyer/cart")} />
            </Row>
          ) : null}
          <Row style={{ gap: spacing.md }}>
            <Button
              title={t("roll.addToCart")}
              variant="secondary"
              onPress={onAddToCart}
              loading={addToCart.isPending && !buyOpen}
              disabled={!breakdown.valid}
              style={{ flex: 1 }}
            />
            <Button
              title={t("roll.buyNow")}
              onPress={() => (requireBuyer() ? setBuyOpen(true) : undefined)}
              disabled={!breakdown.valid}
              style={{ flex: 1 }}
            />
          </Row>
        </View>
      ) : null}

      <Sheet
        visible={buyOpen}
        onClose={() => setBuyOpen(false)}
        title={t("roll.buyNowTitle", { yards: formatNumber(yards) })}
        footer={
          <Button
            title={t("checkout.placeOrder", { total: formatBDT(estimate.total, 2) })}
            onPress={onBuyNow}
            loading={addToCart.isPending || checkout.isPending}
          />
        }
      >
        <FeeBreakdown fees={estimate} estimate />
        <Text variant="label">{t("checkout.paymentMethod")}</Text>
        <PaymentMethodPicker value={payment} onChange={setPayment} />
        <TextField label={t("checkout.deliveryNotes")} value={notes} onChangeText={setNotes} multiline />
      </Sheet>

      {sampleOpen ? (
        <SampleSheet
          rollId={data.id}
          samplePrice={toNumber(data.sample_price)}
          onClose={() => setSampleOpen(false)}
          onSent={() => {
            setSampleOpen(false);
            setNotice(t("roll.sampleSent"));
          }}
        />
      ) : null}
    </View>
  );
}

const OPEN_SAMPLE: SampleStatus[] = ["REQUESTED", "ACCEPTED", "SHIPPED"];
const SWATCH_SIZES: SwatchSize[] = ["A4", "HALF_YARD", "ONE_YARD"];

function SampleSheet({
  rollId,
  samplePrice,
  onClose,
  onSent,
}: {
  rollId: string;
  samplePrice: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const create = useCreateSampleRequest();
  const [size, setSize] = useState<SwatchSize>("A4");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        fabric_roll: rollId,
        swatch_size: size,
        notes: notes.trim() || undefined,
        delivery_address: address.trim() || undefined,
      });
      onSent();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t("roll.sampleTitle")}
      footer={<Button title={t("roll.sendSampleRequest")} onPress={() => void send()} loading={create.isPending} />}
    >
      <Text muted>{t("roll.sampleIntro")}</Text>
      {samplePrice > 0 ? <Text variant="label">{t("roll.samplePrice", { price: formatBDT(samplePrice) })}</Text> : null}
      <Text variant="label">{t("roll.swatchSize")}</Text>
      <Row style={{ flexWrap: "wrap" }}>
        {SWATCH_SIZES.map((s) => (
          <Chip key={s} label={t(`samples.size.${s}`)} selected={size === s} onPress={() => setSize(s)} />
        ))}
      </Row>
      <TextField
        label={t("roll.sampleNotes")}
        value={notes}
        onChangeText={setNotes}
        placeholder={t("roll.sampleNotesPlaceholder")}
        multiline
      />
      <TextField
        label={t("roll.sampleAddress")}
        value={address}
        onChangeText={setAddress}
        hint={t("roll.sampleAddressHint")}
        multiline
      />
      {error ? (
        <Text color={colors.danger} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
});
