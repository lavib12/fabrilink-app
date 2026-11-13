import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";

import { fonts, fontSize, MIN_TOUCH, radius, spacing, useTheme } from "@/theme";

import { Text } from "./primitives";

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, style, multiline, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        maxFontSizeMultiplier={1.6}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            minHeight: multiline ? 96 : MIN_TOUCH + 4,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** TextField bound to react-hook-form. Numbers are kept as strings and coerced by zod. */
export function FormField<T extends FieldValues>({
  control,
  name,
  ...props
}: Omit<TextFieldProps, "value" | "onChangeText" | "error"> & {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          value={field.value == null ? "" : String(field.value)}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          // Schema messages are i18n keys; server messages pass through unchanged.
          error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
  },
});
