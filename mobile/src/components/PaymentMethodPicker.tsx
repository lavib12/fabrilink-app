import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import type { PaymentMethod } from "@/api/types";
import { useCredit } from "@/hooks/queries";
import { formatBDT, toNumber } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { MIN_TOUCH, radius, spacing, useTheme } from "@/theme";

import { Text } from "./ui";

const METHODS: PaymentMethod[] = ["BKASH", "NAGAD", "SSLCOMMERZ", "COD", "B2B_CREDIT"];

/** B2B credit is only offered while the credit line has room left (the server re-checks). */
export function usePaymentMethods(): PaymentMethod[] {
  const credit = useCredit();
  const creditLimit = useAuth((s) => toNumber(s.user?.company?.credit_limit));
  const canUseCredit = credit.data ? credit.data.can_use_credit : creditLimit > 0;
  return METHODS.filter((m) => m !== "B2B_CREDIT" || canUseCredit);
}

/** Remaining credit shown under the B2B credit option. */
function useCreditHint(): string | null {
  const credit = useCredit();
  return credit.data ? formatBDT(credit.data.available) : null;
}

export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const methods = usePaymentMethods();
  const creditLeft = useCreditHint();
  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
      {methods.map((m) => {
        const selected = m === value;
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(m)}
            style={[
              styles.option,
              { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface },
            ]}
          >
            <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t(`payment.${m}`)}</Text>
              <Text variant="caption" muted>
                {m === "B2B_CREDIT" && creditLeft
                  ? t("payment.creditLeft", { amount: creditLeft })
                  : t(`payment.${m}_hint`)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: MIN_TOUCH + 8,
  },
});
