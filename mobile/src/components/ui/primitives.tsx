import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text as RNText,
  type TextProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { fonts, fontSize, MIN_TOUCH, radius, spacing, type ThemeColors, useTheme } from "@/theme";

// ---------- Text ----------

type TextVariant = "title" | "heading" | "subheading" | "body" | "caption" | "label";

// Bangla needs roomier line heights than Latin (tall vowel signs above and below).
const textVariants: Record<TextVariant, TextStyle> = {
  title: { fontSize: fontSize.xxl, lineHeight: 40, fontFamily: fonts.bold, letterSpacing: -0.4 },
  heading: { fontSize: fontSize.xl, lineHeight: 32, fontFamily: fonts.bold, letterSpacing: -0.2 },
  subheading: { fontSize: fontSize.lg, lineHeight: 26, fontFamily: fonts.semibold },
  body: { fontSize: fontSize.md, lineHeight: 24, fontFamily: fonts.regular },
  caption: { fontSize: fontSize.xs, lineHeight: 18, fontFamily: fonts.regular },
  label: { fontSize: fontSize.sm, lineHeight: 21, fontFamily: fonts.semibold },
};

/** Custom fonts need an explicit face per weight; translate `fontWeight` into one. */
function familyForWeight(weight: TextStyle["fontWeight"]): string | undefined {
  switch (String(weight)) {
    case "700":
    case "800":
    case "900":
    case "bold":
      return fonts.bold;
    case "600":
      return fonts.semibold;
    case "500":
      return fonts.medium;
    case "400":
    case "normal":
      return fonts.regular;
    default:
      return undefined;
  }
}

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  muted?: boolean;
  color?: string;
  center?: boolean;
  /** Tabular figures, so prices and yardage line up in columns. */
  numeric?: boolean;
}

export function Text({ variant = "body", muted, color, center, numeric, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten(style) ?? {};
  const weightFamily = flat.fontWeight ? familyForWeight(flat.fontWeight) : undefined;
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      style={[
        textVariants[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        center && { textAlign: "center" },
        numeric && { fontVariant: ["tabular-nums"] },
        flat,
        weightFamily ? { fontFamily: weightFamily, fontWeight: "normal" } : null,
      ]}
      {...rest}
    />
  );
}

// ---------- Button ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  small?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

function buttonColors(variant: ButtonVariant, c: ThemeColors) {
  switch (variant) {
    case "secondary":
      return { bg: c.surfaceMuted, fg: c.text, border: c.border };
    case "ghost":
      return { bg: "transparent", fg: c.primary, border: "transparent" };
    case "danger":
      return { bg: c.danger, fg: "#FFFFFF", border: c.danger };
    case "success":
      return { bg: c.success, fg: "#FFFFFF", border: c.success };
    default:
      return { bg: c.primary, fg: c.primaryText, border: c.primary };
  }
}

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  icon,
  small,
  fullWidth = true,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const c = buttonColors(variant, colors);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (Platform.OS !== "web") void Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          minHeight: small ? 36 : MIN_TOUCH + 4,
          paddingHorizontal: small ? spacing.md : spacing.lg,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text variant="label" color={c.fg} style={{ fontSize: small ? fontSize.sm : fontSize.md }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------- Card ----------

export function Card({ style, children, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function PressableCard({
  style,
  children,
  ...rest
}: Omit<PressableProps, "style"> & { style?: ViewStyle; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

// ---------- Badge ----------

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "primary" | "exclusive";

export function toneColors(tone: Tone, c: ThemeColors) {
  switch (tone) {
    case "info":
      return { bg: c.infoSoft, fg: c.info };
    case "warning":
      return { bg: c.warningSoft, fg: c.warning };
    case "success":
      return { bg: c.successSoft, fg: c.success };
    case "danger":
      return { bg: c.dangerSoft, fg: c.danger };
    case "primary":
      return { bg: c.primarySoft, fg: c.primary };
    case "exclusive":
      return { bg: c.exclusiveSoft, fg: c.exclusive };
    default:
      return { bg: c.surfaceMuted, fg: c.textMuted };
  }
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const t = toneColors(tone, colors);
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text variant="caption" color={t.fg} style={{ fontWeight: "700" }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------- Chip (selectable) ----------

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text variant="label" color={selected ? colors.primaryText : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------- Layout helpers ----------

export function Row({ style, ...rest }: ViewProps) {
  return <View style={[styles.row, style]} {...rest} />;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

export function KeyValue({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: "space-between", paddingVertical: 3 }}>
      <Text muted={!bold} variant={bold ? "label" : "body"} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text variant={bold ? "subheading" : "body"} style={{ fontWeight: bold ? "800" : "500" }}>
        {value}
      </Text>
    </Row>
  );
}

export function ColorDot({ hex, size = 14 }: { hex: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: hex,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  // Squared like a garment hang-tag, so status badges read differently from tappable chips.
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
