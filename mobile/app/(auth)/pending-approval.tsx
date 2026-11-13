import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, View } from "react-native";

import { getErrorMessage } from "@/api/errors";
import { Badge, Button, Card, FormField, Row, Text, type Tone } from "@/components/ui";
import { useMyCompany, useUpdateKyc } from "@/hooks/queries";
import { homeRouteFor, needsKyc } from "@/lib/routing";
import { kycSchema, type KycValues } from "@/lib/schemas";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  REJECTED: "danger",
  SUSPENDED: "danger",
  APPROVED: "success",
};

export default function PendingApprovalScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refreshUser);
  const logout = useAuth((s) => s.logout);
  const company = useMyCompany(Boolean(user));
  const updateKyc = useUpdateKyc();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const { control, handleSubmit, reset } = useForm<KycValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: { trade_license_number: "", tin_number: "", bin_number: "" },
  });

  // Pre-fill with what's already on file.
  useEffect(() => {
    if (company.data) {
      reset({
        trade_license_number: company.data.trade_license_number,
        tin_number: company.data.tin_number,
        bin_number: company.data.bin_number,
      });
    }
  }, [company.data, reset]);

  if (!user) return <Redirect href="/login" />;
  if (!needsKyc(user)) return <Redirect href={homeRouteFor(user) as Href} />;

  const status = user.company?.verification_status ?? "PENDING";

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await refreshUser();
      await company.refetch();
      if (fresh && !needsKyc(fresh)) router.replace(homeRouteFor(fresh) as Href);
    } finally {
      setRefreshing(false);
    }
  };

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await updateKyc.mutateAsync(values);
      setMessage({ ok: true, text: t("kyc.submitted") });
    } catch (err) {
      setMessage({ ok: false, text: getErrorMessage(err) });
    }
  });
  const onSubmit = () => void submit();

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={{ gap: spacing.md, alignItems: "flex-start" }}>
        <Row>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.warning} />
          <Text variant="subheading" style={{ flex: 1 }}>
            {user.company?.name ?? t("kyc.yourCompany")}
          </Text>
        </Row>
        <Badge label={t(`verification.${status}`)} tone={STATUS_TONE[status] ?? "neutral"} />
        <Text muted>{t(`kyc.explain.${status}`)}</Text>
        {company.data?.rejection_reason ? (
          <View style={{ padding: spacing.md, borderRadius: 10, backgroundColor: colors.dangerSoft, alignSelf: "stretch" }}>
            <Text variant="label" color={colors.danger}>
              {t("kyc.reason")}: {company.data.rejection_reason}
            </Text>
          </View>
        ) : null}
        <Text variant="caption" muted>
          {t("kyc.pullToRefresh")}
        </Text>
      </Card>

      <Card style={{ gap: spacing.lg }}>
        <Text variant="subheading">{t("kyc.formTitle")}</Text>
        <FormField control={control} name="trade_license_number" label={t("kyc.tradeLicense")} autoCapitalize="characters" />
        <FormField control={control} name="tin_number" label={t("kyc.tin")} keyboardType="number-pad" />
        <FormField control={control} name="bin_number" label={t("kyc.bin")} />
        {message ? <Text color={message.ok ? colors.success : colors.danger}>{message.text}</Text> : null}
        <Button title={t("kyc.submit")} onPress={onSubmit} loading={updateKyc.isPending} />
      </Card>

      {user.role === "BUYER" ? (
        <Button title={t("kyc.browseMeanwhile")} variant="secondary" onPress={() => router.replace("/buyer")} />
      ) : null}
      <Button title={t("profile.logout")} variant="ghost" onPress={() => void logout().then(() => router.replace("/login"))} />
    </ScrollView>
  );
}
