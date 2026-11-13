import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";

import { formatNumber } from "@/lib/format";
import { fonts, radius, useTheme } from "@/theme";

import { Text } from "./ui";

/** Picks a tick spacing that gives roughly 5–8 labelled marks for the roll length. */
export function rulerStep(length: number): number {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  return candidates.find((s) => length / s <= 8) ?? 1000;
}

/**
 * The roll drawn as a tape measure: 0 yd at the left, the whole roll at the right.
 * Teal = what you're cutting. Madder zones = cut points the breakdown rule forbids
 * (under the minimum cut, or leaving a scrap shorter than it). Tap to jump the cut there.
 */
export function YardRuler({
  value,
  available,
  minCut,
  onPick,
}: {
  value: number;
  available: number;
  minCut: number;
  onPick: (yards: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  if (available <= 0) return null;

  const pct = (yards: number) => `${Math.max(0, Math.min(100, (yards / available) * 100))}%` as const;
  const step = rulerStep(available);
  const majors: number[] = [];
  for (let y = 0; y <= available + 1e-9; y += step) majors.push(Math.round(y * 100) / 100);
  const minors: number[] = [];
  const minorStep = step / 5;
  for (let y = minorStep; y < available; y += minorStep) minors.push(y);

  // Forbidden cut zones (only meaningful when a partial cut is possible at all).
  const tooShortEnd = Math.min(minCut, available);
  const scrapStart = Math.max(available - minCut, tooShortEnd);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onLayout={onLayout}
        onPress={(e) => {
          if (width <= 0) return;
          onPick((e.nativeEvent.locationX / width) * available);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={t("breakdown.rulerLabel")}
        accessibilityValue={{
          min: 0,
          max: Math.round(available),
          now: Math.round(value),
          text: t("breakdown.rulerValue", { yards: formatNumber(value), available: formatNumber(available) }),
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => onPick(value + (e.nativeEvent.actionName === "increment" ? 0.5 : -0.5))}
        style={[styles.tape, { backgroundColor: colors.tape }]}
      >
        {/* Forbidden zones */}
        <View style={[styles.zone, { left: 0, width: pct(tooShortEnd), backgroundColor: colors.danger }]} />
        {scrapStart < available ? (
          <View
            style={[
              styles.zone,
              { left: pct(scrapStart), width: pct(available - scrapStart - available * 0.004), backgroundColor: colors.danger },
            ]}
          />
        ) : null}

        {/* The cut */}
        <View style={[styles.cut, { width: pct(value), backgroundColor: colors.primary }]} />

        {/* Ticks */}
        {minors.map((y) => (
          <View key={`m${y}`} style={[styles.minor, { left: pct(y), backgroundColor: colors.tapeInk }]} />
        ))}
        {majors.map((y) => (
          <View key={`M${y}`} style={[styles.major, { left: pct(y), backgroundColor: colors.tapeInk }]} />
        ))}

        {/* Cut marker */}
        <View style={[styles.marker, { left: pct(value), borderColor: colors.surface, backgroundColor: colors.text }]} />
      </Pressable>

      <View style={styles.labels} importantForAccessibility="no-hide-descendants">
        {majors.map((y) => (
          <Text
            key={`L${y}`}
            variant="caption"
            muted
            numeric
            style={[
              styles.label,
              { left: pct(y) },
              y === 0 ? { transform: [] } : null,
              y >= available - step / 2 && y !== 0 ? { transform: [{ translateX: -28 }] } : null,
            ]}
          >
            {formatNumber(y, 0)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const TAPE_HEIGHT = 44;

const styles = StyleSheet.create({
  tape: { height: TAPE_HEIGHT, borderRadius: radius.sm, overflow: "hidden" },
  zone: { position: "absolute", top: 0, bottom: 0, opacity: 0.28 },
  cut: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.85 },
  minor: { position: "absolute", top: 0, width: StyleSheet.hairlineWidth * 2, height: 9, opacity: 0.55 },
  major: { position: "absolute", top: 0, width: 2, height: 18 },
  marker: { position: "absolute", top: -2, bottom: -2, width: 4, marginLeft: -2, borderWidth: 1 },
  labels: { height: 18 },
  label: { position: "absolute", top: 0, fontFamily: fonts.medium, transform: [{ translateX: -6 }] },
});
