import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Linking, RefreshControl, ScrollView, View } from "react-native";

import { getErrorMessage } from "@/api/errors";
import type { PaymentSubmission, SubmissionStatus } from "@/api/types";
import { SubmissionExtras } from "@/components/PaymentPanel";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, KeyValue, ListSkeleton, PressableCard, Row, Sheet, Text, TextField, type Tone } from "@/components/ui";
import { usePaymentAccounts, usePaymentQueue, useReviewPayment } from "@/hooks/queries";
import { formatBDT, formatDate, formatDateTime, toNumber } from "@/lib/format";
import { spacing, useTheme } from "@/theme";

const FILTERS: SubmissionStatus[] = ["SUBMITTED", "VERIFIED", "REJECTED"];
const TONE: Record<SubmissionStatus, Tone> = { SUBMITTED: "warning", VERIFIED: "success", REJECTED: "danger" };

/** Admin: check each bKash / Nagad / bank proof against the account statement, then verify or reject. */
export default function AdminPaymentsScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SubmissionStatus>("SUBMITTED");
  const queue = usePaymentQueue(status);
  const review = useReviewPayment();
  const [rejecting, setRejecting] = useState<PaymentSubmission | null>(null);

  const verify = (sub: PaymentSubmission) =>
    Alert.alert(t("pay.admin.verifyTitle"), t("pay.admin.verifyBody", { ref: sub.transaction_id, amount: `${sub.currency} ${sub.amount}` }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("pay.admin.verify"),
        onPress: () =>
          review.mutateAsync({ id: sub.id, action: "VERIFY" }).catch((err) => Alert.alert(t("common.errorTitle"), getErrorMessage(err))),
      },
    ]);

  return (
    <>
      <FlatList
        data={queue.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <AccountsCard />
            <Text muted>{t("pay.admin.intro")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {FILTERS.map((f) => (
                <Chip key={f} label={t(`pay.status.${f}`)} selected={status === f} onPress={() => setStatus(f)} />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <SubmissionCard
            sub={item}
            busy={review.isPending}
            onVerify={() => verify(item)}
            onReject={() => setRejecting(item)}
          />
        )}
        ListEmptyComponent={
          queue.isPending ? (
            <ListSkeleton rows={3} />
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
          ) : (
            <EmptyState icon="wallet-outline" title={t("pay.admin.empty")} />
          )
        }
        refreshControl={<RefreshControl refreshing={queue.isRefetching} onRefresh={() => void queue.refetch()} />}
      />
      {rejecting ? (
        <RejectSheet
          sub={rejecting}
          loading={review.isPending}
          onClose={() => setRejecting(null)}
          onConfirm={async (note) => {
            try {
              await review.mutateAsync({ id: rejecting.id, action: "REJECT", note });
              setRejecting(null);
            } catch (err) {
              Alert.alert(t("common.errorTitle"), getErrorMessage(err));
            }
          }}
        />
      ) : null}
    </>
  );
}

/** Shows whether buyers can pay by bKash / Nagad / bank yet, with a shortcut to set it up. */
function AccountsCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const accounts = usePaymentAccounts();
  const a = accounts.data;
  if (!a) return null;
  const ready = [
    { label: "bKash", ok: Boolean(a.bkash_number) },
    { label: "Nagad", ok: Boolean(a.nagad_number) },
    { label: t("accounts.bank"), ok: Boolean(a.bank_account_number && a.bank_name) },
  ];
  const allSet = ready.every((r) => r.ok);
  return (
    <PressableCard
      onPress={() => router.push("/payment-accounts")}
      accessibilityLabel={t("accounts.title")}
      style={{ gap: spacing.xs, borderColor: allSet ? colors.border : colors.warning, backgroundColor: allSet ? colors.surface : colors.warningSoft }}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="label">{t("accounts.title")}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Row>
      <Row style={{ flexWrap: "wrap", gap: spacing.md }}>
        {ready.map((r) => (
          <Row key={r.label} style={{ gap: 4 }}>
            <Ionicons name={r.ok ? "checkmark-circle" : "alert-circle"} size={16} color={r.ok ? colors.success : colors.warning} />
            <Text variant="caption">{r.label}</Text>
          </Row>
        ))}
      </Row>
      {!allSet ? (
        <Text variant="caption" color={colors.warning}>
          {t("accounts.notReady")}
        </Text>
      ) : null}
    </PressableCard>
  );
}

function SubmissionCard({
  sub,
  busy,
  onVerify,
  onReject,
}: {
  sub: PaymentSubmission;
  busy: boolean;
  onVerify: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isBank = sub.method === "BANK_TRANSFER";
  // Only BDT amounts can be compared with the order total directly.
  const short = sub.currency === "BDT" && toNumber(sub.amount) + 0.009 < toNumber(sub.order_total);
  return (
    <Card style={{ gap: spacing.sm }}>
      <PressableCard
        onPress={() => router.push({ pathname: "/order/[id]", params: { id: sub.order_id } })}
        accessibilityLabel={sub.order_number}
        style={{ padding: 0, borderWidth: 0 }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text variant="label">{sub.order_number}</Text>
            <Text variant="caption" muted>
              {sub.buyer_name} · {sub.method_label}
            </Text>
          </View>
          <Badge label={t(`pay.status.${sub.status}`)} tone={TONE[sub.status]} />
        </Row>
      </PressableCard>

      <KeyValue label={t("pay.admin.orderTotal")} value={formatBDT(sub.order_total, 2)} />
      <KeyValue label={t("pay.amountSent")} value={`${sub.currency} ${sub.amount}`} bold />
      {short ? (
        <Text variant="caption" color={colors.danger}>
          {t("pay.admin.short")}
        </Text>
      ) : null}
      <KeyValue label={isBank ? t("pay.form.bankRef") : t("pay.form.trxId")} value={sub.transaction_id} />
      {sub.sender_account ? <KeyValue label={isBank ? t("pay.form.senderIban") : t("pay.senderWallet")} value={sub.sender_account} /> : null}
      {sub.sender_name ? <KeyValue label={t("pay.form.senderName")} value={sub.sender_name} /> : null}
      {sub.sender_bank_name ? <KeyValue label={t("pay.form.senderBank")} value={sub.sender_bank_name} /> : null}
      {sub.sender_bank_country ? <KeyValue label={t("pay.form.country")} value={sub.sender_bank_country} /> : null}
      {sub.sender_swift_code ? <KeyValue label={t("pay.bank.swift")} value={sub.sender_swift_code} /> : null}
      {sub.transfer_date ? <KeyValue label={t("pay.form.date")} value={formatDate(sub.transfer_date)} /> : null}
      <SubmissionExtras sub={sub} />
      {sub.note ? <Text>{sub.note}</Text> : null}
      <Text variant="caption" muted>
        {t("pay.sentAt", { date: formatDateTime(sub.created_at) })}
      </Text>
      {sub.review_note ? (
        <Text variant="caption">
          {t("pay.admin.reviewNote")}: {sub.review_note}
        </Text>
      ) : null}

      {sub.status === "SUBMITTED" ? (
        <>
          {sub.buyer_phone ? (
            <Button
              title={t("pay.admin.callBuyer")}
              variant="ghost"
              small
              icon={<Ionicons name="call-outline" size={16} color={colors.primary} />}
              onPress={() => void Linking.openURL(`tel:${sub.buyer_phone}`)}
            />
          ) : null}
          <Row style={{ gap: spacing.sm }}>
            <Button title={t("pay.admin.reject")} variant="danger" small onPress={onReject} disabled={busy} style={{ flex: 1 }} />
            <Button title={t("pay.admin.verify")} small onPress={onVerify} disabled={busy} style={{ flex: 1 }} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}

function RejectSheet({
  sub,
  loading,
  onClose,
  onConfirm,
}: {
  sub: PaymentSubmission;
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
      title={t("pay.admin.rejectTitle", { ref: sub.transaction_id })}
      footer={<Button title={t("pay.admin.reject")} variant="danger" onPress={() => onConfirm(note)} loading={loading} />}
    >
      <TextField
        label={t("pay.admin.rejectReason")}
        value={note}
        onChangeText={setNote}
        placeholder={t("pay.admin.rejectPlaceholder")}
        multiline
      />
    </Sheet>
  );
}
