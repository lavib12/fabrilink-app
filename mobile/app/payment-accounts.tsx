import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { getErrorMessage, getFieldErrors } from "@/api/errors";
import type { PaymentAccounts } from "@/api/types";
import { Button, Card, Chip, ErrorState, LoadingState, Row, Text, TextField } from "@/components/ui";
import { usePaymentAccounts, useUpdatePaymentAccounts } from "@/hooks/queries";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

type WalletType = PaymentAccounts["bkash_account_type"];
const WALLET_TYPES: WalletType[] = ["PERSONAL", "MERCHANT", "AGENT"];
const FIELDS = [
  "bkash_number", "nagad_number", "bank_account_name", "bank_account_number", "bank_name", "bank_branch",
  "bank_routing_number", "bank_swift_code", "bank_iban", "bank_address", "bank_currencies", "intermediary_bank", "instructions",
] as const;
type Field = (typeof FIELDS)[number];

/** Admin: where buyers send bKash, Nagad and bank payments. Shown on every unpaid order. */
export default function PaymentAccountsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isAdmin = useAuth((s) => s.user?.role === "ADMIN");
  const accounts = usePaymentAccounts(isAdmin);
  const save = useUpdatePaymentAccounts();
  const [f, setF] = useState<Record<Field, string> | null>(null);
  const [types, setTypes] = useState<{ bkash: WalletType; nagad: WalletType }>({ bkash: "PERSONAL", nagad: "PERSONAL" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const a = accounts.data;
    if (!a || f) return;
    setF(Object.fromEntries(FIELDS.map((k) => [k, a[k] ?? ""])) as Record<Field, string>);
    setTypes({ bkash: a.bkash_account_type, nagad: a.nagad_account_type });
  }, [accounts.data, f]);

  if (!isAdmin) return <Redirect href="/" />;
  if (accounts.isError) return <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />;
  if (!f) return <LoadingState />;

  const set = (k: Field) => (v: string) => {
    setSaved(false);
    setF((s) => (s ? { ...s, [k]: v } : s));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };
  const field = (k: Field, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField label={t(`accounts.${k}`)} value={f[k]} onChangeText={set(k)} error={errors[k]} {...extra} />
  );

  const onSave = async () => {
    setErrors({});
    try {
      await save.mutateAsync({ ...f, bkash_account_type: types.bkash, nagad_account_type: types.nagad });
      setSaved(true);
    } catch (err) {
      const fe = getFieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) Alert.alert(t("common.errorTitle"), getErrorMessage(err));
    }
  };

  const typeChips = (which: "bkash" | "nagad") => (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{t("accounts.accountType")}</Text>
      <Row style={{ flexWrap: "wrap" }}>
        {WALLET_TYPES.map((wt) => (
          <Chip key={wt} label={t(`accounts.type.${wt}`)} selected={types[which] === wt} onPress={() => { setSaved(false); setTypes((s) => ({ ...s, [which]: wt })); }} />
        ))}
      </Row>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t("accounts.title") }} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text muted>{t("accounts.intro")}</Text>

        <Card style={{ gap: spacing.md }}>
          <Text variant="subheading">bKash</Text>
          {field("bkash_number", { keyboardType: "phone-pad", placeholder: "01XXXXXXXXX" })}
          {typeChips("bkash")}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="subheading">Nagad</Text>
          {field("nagad_number", { keyboardType: "phone-pad", placeholder: "01XXXXXXXXX" })}
          {typeChips("nagad")}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="subheading">{t("accounts.bank")}</Text>
          {field("bank_account_name")}
          {field("bank_account_number", { keyboardType: "number-pad" })}
          {field("bank_name")}
          {field("bank_branch")}
          {field("bank_routing_number", { keyboardType: "number-pad", hint: t("accounts.routingHint") })}
          {field("bank_swift_code", { autoCapitalize: "characters", maxLength: 11, hint: t("accounts.swiftHint") })}
          {field("bank_currencies", { autoCapitalize: "characters", hint: t("accounts.currenciesHint") })}
          {field("bank_iban", { autoCapitalize: "characters", hint: t("accounts.optional") })}
          {field("bank_address", { hint: t("accounts.optional") })}
          {field("intermediary_bank", { hint: t("accounts.intermediaryHint") })}
        </Card>

        <Card style={{ gap: spacing.md }}>
          {field("instructions", { multiline: true, hint: t("accounts.instructionsHint") })}
        </Card>

        {saved ? (
          <Text color={colors.success} variant="label" center accessibilityLiveRegion="polite">
            {t("accounts.saved")}
          </Text>
        ) : null}
        <Button title={t("accounts.save")} onPress={() => void onSave()} loading={save.isPending} />
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
