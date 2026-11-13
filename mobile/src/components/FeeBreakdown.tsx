import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { Fees } from "@/api/types";
import { formatBDT, toNumber } from "@/lib/format";
import type { FeeEstimate } from "@/lib/pricing";
import { spacing } from "@/theme";

import { Divider, KeyValue, Text } from "./ui";

/** Normalises server `Fees` (strings) and local `FeeEstimate` (numbers) into rows. */
function toRows(fees: Fees | FeeEstimate) {
  if ("items_subtotal" in fees) {
    return {
      fabric: toNumber(fees.items_subtotal),
      commission: toNumber(fees.platform_commission_fee),
      cutting: toNumber(fees.cutting_fee),
      delivery: toNumber(fees.delivery_fee),
      vat: toNumber(fees.vat_tax_amount),
      total: toNumber(fees.total_amount),
    };
  }
  return fees;
}

export function FeeBreakdown({ fees, estimate = false }: { fees: Fees | FeeEstimate; estimate?: boolean }) {
  const { t } = useTranslation();
  const r = toRows(fees);
  return (
    <View style={{ gap: 2 }}>
      {estimate ? (
        <Text variant="caption" muted style={{ marginBottom: spacing.xs }}>
          {t("fees.estimateNote")}
        </Text>
      ) : null}
      <KeyValue label={t("fees.fabric")} value={formatBDT(r.fabric, 2)} />
      <KeyValue label={t("fees.commission")} value={formatBDT(r.commission, 2)} />
      <KeyValue label={t("fees.cutting")} value={formatBDT(r.cutting, 2)} />
      <KeyValue label={t("fees.delivery")} value={formatBDT(r.delivery, 2)} />
      <KeyValue label={t("fees.vat")} value={formatBDT(r.vat, 2)} />
      <Divider />
      <KeyValue label={estimate ? t("fees.estimatedTotal") : t("fees.total")} value={formatBDT(r.total, 2)} bold />
    </View>
  );
}
