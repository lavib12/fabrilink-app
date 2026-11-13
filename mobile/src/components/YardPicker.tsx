import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { checkBreakdown, maxPartialCut, snapYards } from "@/lib/breakdown";
import { formatNumber } from "@/lib/format";
import { fonts, MIN_TOUCH, radius, spacing, useTheme } from "@/theme";

import { Chip, Row, Text } from "./ui";
import { YardRuler } from "./YardRuler";

const STEP = 0.5;

export function YardPicker({
  value,
  onChange,
  available,
  minCut,
}: {
  value: number;
  onChange: (yards: number) => void;
  available: number;
  minCut: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [text, setText] = useState(String(value));
  const result = checkBreakdown(value, available, minCut);
  const partialMax = maxPartialCut(available, minCut);

  // Keep the text box in sync when the value changes from a button.
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const set = (n: number) => onChange(snapYards(n, available, 0.01));
  const step = (dir: 1 | -1) => onChange(snapYards(value + dir * STEP, available, STEP));

  const issueText = result.issue
    ? t(`breakdown.${result.issue}`, {
        min: formatNumber(minCut),
        available: formatNumber(available),
        leftover: formatNumber(result.leftover),
      })
    : t("breakdown.ok", { leftover: formatNumber(result.leftover) });

  return (
    <View style={{ gap: spacing.md }}>
      <YardRuler
        value={value}
        available={available}
        minCut={minCut}
        onPick={(n) => onChange(snapYards(n, available, STEP))}
      />
      <Row style={{ justifyContent: "center", gap: spacing.md }}>
        <StepButton icon="remove" label={t("breakdown.decrease")} onPress={() => step(-1)} disabled={value <= 0} />
        <View style={[styles.inputWrap, { borderColor: result.valid ? colors.border : colors.danger, backgroundColor: colors.surface }]}>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              const n = Number(v.replace(",", "."));
              if (Number.isFinite(n)) set(n);
            }}
            keyboardType="decimal-pad"
            accessibilityLabel={t("breakdown.yards")}
            style={[styles.input, { color: colors.text }]}
            maxFontSizeMultiplier={1.4}
            selectTextOnFocus
          />
          <Text muted>{t("common.yd")}</Text>
        </View>
        <StepButton icon="add" label={t("breakdown.increase")} onPress={() => step(1)} disabled={value >= available} />
      </Row>

      <Row style={{ flexWrap: "wrap", justifyContent: "center" }}>
        <Chip label={t("breakdown.minCut", { min: formatNumber(minCut) })} onPress={() => set(minCut)} />
        {partialMax !== null ? (
          <Chip label={t("breakdown.maxPartial", { max: formatNumber(partialMax) })} onPress={() => set(partialMax)} />
        ) : null}
        <Chip label={t("breakdown.wholeRoll", { available: formatNumber(available) })} onPress={() => set(available)} />
      </Row>

      <Row
        style={[styles.notice, { backgroundColor: result.valid ? colors.successSoft : colors.dangerSoft }]}
        accessibilityLiveRegion="polite"
      >
        <Ionicons
          name={result.valid ? "checkmark-circle" : "warning"}
          size={18}
          color={result.valid ? colors.success : colors.danger}
        />
        <Text variant="caption" color={result.valid ? colors.success : colors.danger} style={{ flex: 1, fontWeight: "600" }}>
          {issueText}
        </Text>
      </Row>
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: "add" | "remove";
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.stepBtn, { borderColor: colors.border, backgroundColor: colors.surface, opacity: disabled ? 0.4 : 1 }]}
    >
      <Ionicons name={icon} size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepBtn: {
    width: MIN_TOUCH + 4,
    height: MIN_TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH + 4,
    minWidth: 130,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontFamily: fonts.bold,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    paddingVertical: 4,
  },
  notice: { padding: spacing.md, borderRadius: radius.md, alignItems: "flex-start" },
});
