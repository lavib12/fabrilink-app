import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Linking, RefreshControl, ScrollView, View } from "react-native";

import { getErrorMessage } from "@/api/errors";
import type { SampleRequest, SampleStatus } from "@/api/types";
import { Badge, Button, Card, Chip, ColorDot, EmptyState, ErrorState, KeyValue, ListSkeleton, PressableCard, Row, Sheet, Text, TextField, type Tone } from "@/components/ui";
import { useSampleRequests, useSetSampleStatus } from "@/hooks/queries";
import { formatBDT, formatDate, toNumber } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

const TONE: Record<SampleStatus, Tone> = {
  REQUESTED: "warning",
  ACCEPTED: "info",
  SHIPPED: "primary",
  DELIVERED: "success",
  DECLINED: "danger",
  CANCELLED: "neutral",
};
const FILTERS: (SampleStatus | undefined)[] = [undefined, "REQUESTED", "ACCEPTED", "SHIPPED", "DELIVERED"];

type Action = { status: SampleStatus; label: string; variant?: "secondary" | "danger"; askNote?: string };

/** Buyers see the samples they asked for; mills see requests for their rolls; admins see all. */
export default function SampleRequestsScreen() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [status, setStatus] = useState<SampleStatus | undefined>(undefined);
  const samples = useSampleRequests({ status }, Boolean(user));
  const setSampleStatus = useSetSampleStatus();
  const [pending, setPending] = useState<{ sample: SampleRequest; action: Action } | null>(null);

  if (!user) return <Redirect href="/login" />;
  const isBuyer = user.role === "BUYER";
  const isMill = user.role === "FACTORY" || user.role === "ADMIN";

  const actionsFor = (s: SampleRequest): Action[] => {
    if (isMill && !isBuyer) {
      if (s.status === "REQUESTED")
        return [
          { status: "ACCEPTED", label: t("samples.accept") },
          { status: "DECLINED", label: t("samples.decline"), variant: "danger", askNote: t("samples.declineNoteTitle") },
        ];
      if (s.status === "ACCEPTED") return [{ status: "SHIPPED", label: t("samples.markShipped"), askNote: t("samples.shipNoteTitle") }];
      if (s.status === "SHIPPED") return [{ status: "DELIVERED", label: t("samples.markDelivered"), variant: "secondary" }];
      return [];
    }
    if (s.status === "SHIPPED") return [{ status: "DELIVERED", label: t("samples.markReceived") }];
    if (s.status === "REQUESTED" || s.status === "ACCEPTED")
      return [{ status: "CANCELLED", label: t("samples.cancel"), variant: "secondary" }];
    return [];
  };

  const run = async (sample: SampleRequest, action: Action, note?: string) => {
    try {
      await setSampleStatus.mutateAsync({ id: sample.id, status: action.status, note: note?.trim() || undefined });
      setPending(null);
    } catch (err) {
      Alert.alert(t("common.errorTitle"), getErrorMessage(err));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("samples.title") }} />
      <FlatList
        data={samples.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {FILTERS.map((f) => (
              <Chip
                key={f ?? "ALL"}
                label={f ? t(`samples.status.${f}`) : t("samples.all")}
                selected={status === f}
                onPress={() => setStatus(f)}
              />
            ))}
          </ScrollView>
        }
        renderItem={({ item }) => (
          <SampleCard
            sample={item}
            showBuyer={!isBuyer}
            actions={actionsFor(item)}
            busy={setSampleStatus.isPending}
            onAction={(action) => (action.askNote ? setPending({ sample: item, action }) : void run(item, action))}
          />
        )}
        ListEmptyComponent={
          samples.isPending ? (
            <ListSkeleton rows={3} />
          ) : samples.isError ? (
            <ErrorState error={samples.error} onRetry={() => void samples.refetch()} />
          ) : (
            <EmptyState
              icon="cube-outline"
              title={isBuyer ? t("samples.emptyBuyerTitle") : t("samples.emptyFactoryTitle")}
              message={isBuyer ? t("samples.emptyBuyerBody") : t("samples.emptyFactoryBody")}
              actionLabel={isBuyer ? t("samples.browse") : undefined}
              onAction={isBuyer ? () => router.navigate("/buyer") : undefined}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={samples.isRefetching} onRefresh={() => void samples.refetch()} />}
      />
      {pending ? (
        <NoteSheet
          title={pending.action.label}
          label={pending.action.askNote ?? ""}
          loading={setSampleStatus.isPending}
          onClose={() => setPending(null)}
          onConfirm={(note) => void run(pending.sample, pending.action, note)}
        />
      ) : null}
    </>
  );
}

function SampleCard({
  sample,
  showBuyer,
  actions,
  busy,
  onAction,
}: {
  sample: SampleRequest;
  showBuyer: boolean;
  actions: Action[];
  busy: boolean;
  onAction: (a: Action) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <PressableCard
        onPress={() => router.push({ pathname: "/roll/[id]", params: { id: sample.roll_id } })}
        accessibilityLabel={sample.roll_title}
        style={{ padding: 0, borderWidth: 0 }}
      >
        <Row style={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" numberOfLines={2}>
              {sample.roll_title}
            </Text>
            <Row style={{ gap: 6 }}>
              <ColorDot hex={sample.roll_color_hex} />
              <Text variant="caption" muted>
                {sample.roll_color_name} · {sample.roll_code}
              </Text>
            </Row>
          </View>
          <Badge label={t(`samples.status.${sample.status}`)} tone={TONE[sample.status]} />
        </Row>
      </PressableCard>

      <KeyValue label={t("roll.swatchSize")} value={t(`samples.size.${sample.swatch_size}`)} />
      <KeyValue
        label={showBuyer ? t("samples.buyerLabel") : t("samples.millLabel")}
        value={showBuyer ? sample.buyer_name : sample.factory_name}
      />
      {toNumber(sample.sample_price) > 0 ? (
        <KeyValue label={t("samples.priceLabel")} value={formatBDT(sample.sample_price)} />
      ) : null}
      <Text variant="caption" muted>
        {t("samples.requestedOn", { date: formatDate(sample.created_at) })}
      </Text>
      {sample.delivery_address ? (
        <View>
          <Text variant="caption" muted>
            {t("samples.deliverTo")}
          </Text>
          <Text>{sample.delivery_address}</Text>
        </View>
      ) : null}
      {sample.notes ? (
        <View>
          <Text variant="caption" muted>
            {t("samples.buyerNotes")}
          </Text>
          <Text>{sample.notes}</Text>
        </View>
      ) : null}
      {sample.factory_note ? (
        <View>
          <Text variant="caption" muted>
            {t("samples.millNote")}
          </Text>
          <Text>{sample.factory_note}</Text>
        </View>
      ) : null}

      {showBuyer && sample.buyer_phone && actions.length > 0 ? (
        <Button
          title={t("samples.callBuyer")}
          variant="ghost"
          small
          icon={<Ionicons name="call-outline" size={16} color={colors.primary} />}
          onPress={() => void Linking.openURL(`tel:${sample.buyer_phone}`)}
        />
      ) : null}
      {actions.length ? (
        <Row style={{ gap: spacing.sm }}>
          {actions.map((a) => (
            <Button key={a.status} title={a.label} variant={a.variant} small onPress={() => onAction(a)} disabled={busy} style={{ flex: 1 }} />
          ))}
        </Row>
      ) : null}
    </Card>
  );
}

function NoteSheet({
  title,
  label,
  loading,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  return (
    <Sheet
      visible
      onClose={onClose}
      title={title}
      footer={<Button title={t("samples.confirm")} onPress={() => onConfirm(note)} loading={loading} />}
    >
      <TextField label={label} value={note} onChangeText={setNote} multiline />
    </Sheet>
  );
}
