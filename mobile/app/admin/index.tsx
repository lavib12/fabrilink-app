import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, RefreshControl, ScrollView } from "react-native";

import type { VerifyInput } from "@/api/endpoints/companies";
import { getErrorMessage } from "@/api/errors";
import type { Company, Verification } from "@/api/types";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, KeyValue, ListSkeleton, Row, Sheet, Text, TextField, type Tone } from "@/components/ui";
import { useKycQueue, useVerifyCompany } from "@/hooks/queries";
import { formatBDT, formatDate, toNumber } from "@/lib/format";
import { spacing } from "@/theme";

const TABS: (Verification | "ALL")[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "ALL"];
const TONE: Record<Verification, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" };

type Action = { company: Company; kind: "APPROVE" | "REJECT" | "SUSPEND" };

export default function AdminKycScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Verification | "ALL">("PENDING");
  const queue = useKycQueue(tab);
  const [action, setAction] = useState<Action | null>(null);

  return (
    <>
      <FlatList
        data={queue.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {TABS.map((s) => (
              <Chip key={s} label={s === "ALL" ? t("orders.all") : t(`verification.${s}`)} selected={tab === s} onPress={() => setTab(s)} />
            ))}
          </ScrollView>
        }
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="subheading" style={{ flex: 1 }}>
                {item.name}
              </Text>
              <Badge label={t(`verification.${item.verification_status}`)} tone={TONE[item.verification_status]} />
            </Row>
            <Badge label={item.company_type === "FACTORY" ? t("auth.roleFactory") : t("auth.roleBuyer")} tone="primary" />
            <KeyValue label={t("kyc.tradeLicense")} value={item.trade_license_number || "—"} />
            <KeyValue label={t("kyc.tin")} value={item.tin_number || "—"} />
            <KeyValue label={t("kyc.bin")} value={item.bin_number || "—"} />
            <KeyValue label={t("auth.email")} value={item.contact_email} />
            <KeyValue label={t("auth.phone")} value={item.contact_phone} />
            <KeyValue label={t("admin.registered")} value={formatDate(item.created_at)} />
            {toNumber(item.credit_limit) > 0 ? (
              <KeyValue
                label={t("profile.creditLimit")}
                value={t("admin.creditValue", { limit: formatBDT(item.credit_limit), days: item.credit_terms_days })}
              />
            ) : null}
            {item.rejection_reason ? <Text muted>{t("kyc.reason")}: {item.rejection_reason}</Text> : null}
            <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {item.verification_status !== "APPROVED" ? (
                <Button title={t("admin.approve")} variant="success" small onPress={() => setAction({ company: item, kind: "APPROVE" })} style={{ flex: 1 }} />
              ) : (
                <Button title={t("admin.suspend")} variant="secondary" small onPress={() => setAction({ company: item, kind: "SUSPEND" })} style={{ flex: 1 }} />
              )}
              {item.verification_status === "PENDING" ? (
                <Button title={t("admin.reject")} variant="danger" small onPress={() => setAction({ company: item, kind: "REJECT" })} style={{ flex: 1 }} />
              ) : null}
            </Row>
          </Card>
        )}
        ListEmptyComponent={
          queue.isPending ? (
            <ListSkeleton />
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
          ) : (
            <EmptyState icon="shield-checkmark-outline" title={t("admin.emptyQueue")} />
          )
        }
        refreshControl={<RefreshControl refreshing={queue.isRefetching} onRefresh={() => void queue.refetch()} />}
      />
      {action ? <VerifySheet action={action} onClose={() => setAction(null)} /> : null}
    </>
  );
}

function VerifySheet({ action, onClose }: { action: Action; onClose: () => void }) {
  const { t } = useTranslation();
  const verify = useVerifyCompany();
  const [creditLimit, setCreditLimit] = useState(action.company.company_type === "BUYER" ? "50000" : "0");
  const [terms, setTerms] = useState("30");
  const [reason, setReason] = useState("");
  const isApprove = action.kind === "APPROVE";

  const submit = async () => {
    const input: VerifyInput = { action: action.kind };
    if (isApprove) {
      const limit = Number(creditLimit);
      const days = Number(terms);
      if (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(days) || days < 0) {
        Alert.alert(t("common.errorTitle"), t("admin.invalidCredit"));
        return;
      }
      input.credit_limit = limit.toFixed(2);
      input.credit_terms_days = days;
    } else {
      input.rejection_reason = reason.trim() || undefined;
    }
    try {
      await verify.mutateAsync({ id: action.company.id, input });
      onClose();
    } catch (err) {
      Alert.alert(t("common.errorTitle"), getErrorMessage(err));
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t(`admin.${action.kind.toLowerCase()}Title`, { name: action.company.name })}
      footer={
        <Button
          title={t(`admin.${action.kind.toLowerCase()}`)}
          variant={isApprove ? "success" : "danger"}
          onPress={() => void submit()}
          loading={verify.isPending}
        />
      }
    >
      {isApprove ? (
        <>
          <TextField label={t("admin.creditLimit")} value={creditLimit} onChangeText={setCreditLimit} keyboardType="decimal-pad" hint={t("admin.creditHint")} />
          <TextField label={t("admin.creditTerms")} value={terms} onChangeText={setTerms} keyboardType="number-pad" />
        </>
      ) : (
        <TextField label={t("admin.reason")} value={reason} onChangeText={setReason} multiline placeholder={t("admin.reasonPlaceholder")} />
      )}
    </Sheet>
  );
}
