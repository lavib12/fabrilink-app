import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { getErrorMessage, getFieldErrors } from "@/api/errors";
import type { ManualPaymentMethod, Order, PaymentAccounts, PaymentSubmission } from "@/api/types";
import { Badge, Button, Card, Chip, Divider, KeyValue, Row, Text, TextField } from "@/components/ui";
import { useOrderPayments, usePaymentAccounts, useSubmitPayment } from "@/hooks/queries";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { MIN_TOUCH, spacing, useTheme } from "@/theme";

const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "AED", "SAR", "MYR", "SGD"];

const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** A labelled value with a copy button (account numbers, amount, reference). */
function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <Row style={{ justifyContent: "space-between", paddingVertical: 4, gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>
          {label}
        </Text>
        <Text variant="label" selectable>
          {value}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("pay.copyLabel", { label })}
        onPress={() => {
          void Clipboard.setStringAsync(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={copied ? colors.success : colors.primary} />
      </Pressable>
    </Row>
  );
}

function WalletInstructions({ method, accounts, order }: { method: "BKASH" | "NAGAD"; accounts: PaymentAccounts; order: Order }) {
  const { t } = useTranslation();
  const number = method === "BKASH" ? accounts.bkash_number : accounts.nagad_number;
  const type = method === "BKASH" ? accounts.bkash_account_type : accounts.nagad_account_type;
  const label = method === "BKASH" ? accounts.bkash_account_type_label : accounts.nagad_account_type_label;
  const wallet = t(`payment.${method}`);
  return (
    <View style={{ gap: spacing.xs }}>
      <CopyRow label={t("pay.sendTo", { wallet, type: label })} value={number} />
      <CopyRow label={t("pay.amountToSend")} value={String(order.total_amount)} />
      <CopyRow label={t("pay.reference")} value={order.order_number} />
      <Text variant="caption" muted style={{ marginTop: spacing.xs }}>
        {t(`pay.walletSteps.${type}`, { wallet })}
      </Text>
    </View>
  );
}

function BankInstructions({ accounts, order }: { accounts: PaymentAccounts; order: Order }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.xs }}>
      <CopyRow label={t("pay.bank.accountName")} value={accounts.bank_account_name} />
      <CopyRow label={t("pay.bank.accountNumber")} value={accounts.bank_account_number} />
      <CopyRow label={t("pay.bank.bankName")} value={accounts.bank_name} />
      <CopyRow label={t("pay.bank.branch")} value={accounts.bank_branch} />
      <CopyRow label={t("pay.bank.routing")} value={accounts.bank_routing_number} />
      <CopyRow label={t("pay.bank.swift")} value={accounts.bank_swift_code} />
      <CopyRow label="IBAN" value={accounts.bank_iban} />
      <CopyRow label={t("pay.bank.address")} value={accounts.bank_address} />
      <CopyRow label={t("pay.bank.intermediary")} value={accounts.intermediary_bank} />
      {accounts.bank_currencies ? <KeyValue label={t("pay.bank.currencies")} value={accounts.bank_currencies} /> : null}
      <Divider />
      <CopyRow label={t("pay.amountToSend")} value={`BDT ${order.total_amount}`} />
      <CopyRow label={t("pay.reference")} value={order.order_number} />
      <Text variant="caption" muted style={{ marginTop: spacing.xs }}>
        {t("pay.bank.localNote")}
      </Text>
      <Text variant="caption" muted>
        {t("pay.bank.intlNote")}
      </Text>
    </View>
  );
}

function hasAccount(method: ManualPaymentMethod, a: PaymentAccounts) {
  if (method === "BKASH") return Boolean(a.bkash_number);
  if (method === "NAGAD") return Boolean(a.nagad_number);
  return Boolean(a.bank_account_number && a.bank_name);
}

function SubmissionSummary({ sub }: { sub: PaymentSubmission }) {
  const { t } = useTranslation();
  const isBank = sub.method === "BANK_TRANSFER";
  return (
    <View style={{ gap: 2 }}>
      <KeyValue label={t("pay.amountSent")} value={`${sub.currency} ${sub.amount}`} />
      <KeyValue label={isBank ? t("pay.form.bankRef") : t("pay.form.trxId")} value={sub.transaction_id} />
      {sub.sender_account ? <KeyValue label={isBank ? t("pay.form.senderIban") : t("pay.senderWallet")} value={sub.sender_account} /> : null}
      {sub.sender_name ? <KeyValue label={t("pay.form.senderName")} value={sub.sender_name} /> : null}
      {sub.sender_bank_name ? <KeyValue label={t("pay.form.senderBank")} value={sub.sender_bank_name} /> : null}
      {sub.sender_bank_country ? <KeyValue label={t("pay.form.country")} value={sub.sender_bank_country} /> : null}
      {sub.sender_swift_code ? <KeyValue label={t("pay.bank.swift")} value={sub.sender_swift_code} /> : null}
      {sub.transfer_date ? <KeyValue label={t("pay.form.date")} value={formatDate(sub.transfer_date)} /> : null}
      <Text variant="caption" muted>
        {t("pay.sentAt", { date: formatDateTime(sub.created_at) })}
      </Text>
    </View>
  );
}

function PaymentForm({ order, method, onDone }: { order: Order; method: ManualPaymentMethod; onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const submit = useSubmitPayment(order.id);
  const isBank = method === "BANK_TRANSFER";
  const [f, setF] = useState({
    amount: String(order.total_amount),
    currency: "BDT",
    transaction_id: "",
    sender_account: "",
    sender_name: "",
    sender_bank_name: "",
    sender_bank_country: "Bangladesh",
    sender_swift_code: "",
    transfer_date: todayIso(),
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const abroad = isBank && f.sender_bank_country.trim().toLowerCase() !== "bangladesh";

  const send = async () => {
    setErrors({});
    setFormError(null);
    try {
      await submit.mutateAsync(
        isBank
          ? { ...f, transfer_date: f.transfer_date || null }
          : { amount: f.amount, transaction_id: f.transaction_id, sender_account: f.sender_account, note: f.note }
      );
      onDone();
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="label">{t("pay.form.title")}</Text>
      {isBank ? (
        <>
          <TextField label={t("pay.form.senderName")} value={f.sender_name} onChangeText={set("sender_name")} error={errors.sender_name} />
          <TextField label={t("pay.form.senderBank")} value={f.sender_bank_name} onChangeText={set("sender_bank_name")} error={errors.sender_bank_name} />
          <TextField label={t("pay.form.country")} value={f.sender_bank_country} onChangeText={set("sender_bank_country")} error={errors.sender_bank_country} />
          <TextField
            label={t("pay.form.senderIban")}
            value={f.sender_account}
            onChangeText={set("sender_account")}
            autoCapitalize="characters"
            error={errors.sender_account}
          />
          {abroad ? (
            <TextField
              label={t("pay.form.senderSwift")}
              value={f.sender_swift_code}
              onChangeText={set("sender_swift_code")}
              autoCapitalize="characters"
              maxLength={11}
              error={errors.sender_swift_code}
            />
          ) : null}
          <View style={{ gap: spacing.sm }}>
            <Text variant="label">{t("pay.form.currency")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} selected={f.currency === c} onPress={() => set("currency")(c)} />
              ))}
            </ScrollView>
          </View>
          <TextField label={t("pay.form.amount", { currency: f.currency })} value={f.amount} onChangeText={set("amount")} keyboardType="decimal-pad" error={errors.amount} />
          <TextField
            label={t("pay.form.date")}
            value={f.transfer_date}
            onChangeText={set("transfer_date")}
            placeholder="YYYY-MM-DD"
            hint={t("pay.form.dateHint")}
            error={errors.transfer_date}
          />
          <TextField
            label={t("pay.form.bankRef")}
            value={f.transaction_id}
            onChangeText={set("transaction_id")}
            autoCapitalize="characters"
            hint={t("pay.form.bankRefHint")}
            error={errors.transaction_id}
          />
        </>
      ) : (
        <>
          <TextField
            label={t("pay.form.walletNumber")}
            value={f.sender_account}
            onChangeText={set("sender_account")}
            keyboardType="phone-pad"
            placeholder="01XXXXXXXXX"
            error={errors.sender_account}
          />
          <TextField
            label={t("pay.form.trxId")}
            value={f.transaction_id}
            onChangeText={set("transaction_id")}
            autoCapitalize="characters"
            placeholder="e.g. 9A7B3C1D2E"
            hint={t("pay.form.trxHint", { wallet: t(`payment.${method}`) })}
            error={errors.transaction_id}
          />
          <TextField label={t("pay.form.amount", { currency: "BDT" })} value={f.amount} onChangeText={set("amount")} keyboardType="decimal-pad" error={errors.amount} />
        </>
      )}
      <TextField label={t("pay.form.note")} value={f.note} onChangeText={set("note")} multiline />
      {formError && Object.keys(errors).length === 0 ? (
        <Text color={colors.danger} accessibilityLiveRegion="assertive">
          {formError}
        </Text>
      ) : null}
      <Button title={t("pay.form.submit")} onPress={() => void send()} loading={submit.isPending} />
    </View>
  );
}

/**
 * Shown on an order paid by bKash / Nagad / bank transfer: how to pay, the proof form,
 * and the review state. Buyers fill it in; everyone else sees the status.
 */
export function PaymentPanel({ order, isBuyer }: { order: Order; isBuyer: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const method = order.payment_method as ManualPaymentMethod;
  const status = order.payment_status;
  const needsProof = status === "AWAITING" || status === "REJECTED";
  const accounts = usePaymentAccounts(isBuyer && needsProof);
  const payments = useOrderPayments(order.id, status !== "AWAITING");
  const latest = payments.data?.[0];
  const [justSent, setJustSent] = useState(false);

  if (status === "NOT_REQUIRED") return null;

  if (status === "VERIFIED") {
    return (
      <Card style={{ gap: spacing.sm, borderColor: colors.success }}>
        <Row>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text variant="subheading" color={colors.success} style={{ flex: 1 }}>
            {t("pay.verifiedTitle")}
          </Text>
        </Row>
        {latest ? <SubmissionSummary sub={latest} /> : null}
      </Card>
    );
  }

  if (status === "SUBMITTED" || justSent) {
    return (
      <Card style={{ gap: spacing.sm, backgroundColor: colors.infoSoft, borderColor: colors.info }}>
        <Row>
          <Ionicons name="time-outline" size={22} color={colors.info} />
          <Text variant="subheading" style={{ flex: 1 }}>
            {t("pay.reviewTitle")}
          </Text>
        </Row>
        <Text muted>{t("pay.reviewBody")}</Text>
        {latest ? <SubmissionSummary sub={latest} /> : null}
      </Card>
    );
  }

  // AWAITING or REJECTED
  if (!isBuyer) {
    return (
      <Card style={{ gap: spacing.sm, borderColor: colors.warning }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="subheading">{t("pay.awaitingTitle")}</Text>
          <Badge label={t(`pay.status.${status}`)} tone={status === "REJECTED" ? "danger" : "warning"} />
        </Row>
        <Text muted>{t("pay.awaitingOps")}</Text>
      </Card>
    );
  }

  const a = accounts.data;
  return (
    <Card style={{ gap: spacing.md, borderColor: colors.warning, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="subheading" style={{ flex: 1 }}>
          {t("pay.payTitle", { method: t(`payment.${method}`) })}
        </Text>
        <Text variant="subheading" color={colors.primary}>
          {formatBDT(order.total_amount, 2)}
        </Text>
      </Row>

      {status === "REJECTED" && latest ? (
        <View style={{ gap: 4, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.dangerSoft }}>
          <Text variant="label" color={colors.danger}>
            {t("pay.rejectedTitle")}
          </Text>
          <Text>{latest.review_note || t("pay.rejectedBody")}</Text>
        </View>
      ) : (
        <Text muted>{t("pay.payIntro")}</Text>
      )}

      {accounts.isPending ? (
        <Text muted>…</Text>
      ) : a && hasAccount(method, a) ? (
        <>
          <Text variant="label">{t("pay.step1")}</Text>
          {method === "BANK_TRANSFER" ? <BankInstructions accounts={a} order={order} /> : <WalletInstructions method={method} accounts={a} order={order} />}
          {a.instructions ? <Text variant="caption">{a.instructions}</Text> : null}
          <Divider />
          <PaymentForm order={order} method={method} onDone={() => setJustSent(true)} />
        </>
      ) : (
        <Text color={colors.warning}>{t("pay.notSetUp", { method: t(`payment.${method}`) })}</Text>
      )}
    </Card>
  );
}
