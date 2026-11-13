import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router, type Href } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { getErrorMessage } from "@/api/errors";
import { Button, Card, FormField, Text } from "@/components/ui";
import { homeRouteFor } from "@/lib/routing";
import { loginSchema, type LoginValues } from "@/lib/schemas";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const login = useAuth((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      router.replace(homeRouteFor(user) as Href);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  });
  const onSubmit = () => void submit();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <Text variant="title">FabriLink</Text>
          <Text muted>{t("auth.loginSubtitle")}</Text>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <FormField
            control={control}
            name="email"
            label={t("auth.email")}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@company.com"
          />
          <FormField
            control={control}
            name="password"
            label={t("auth.password")}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={onSubmit}
          />
          {serverError ? (
            <Text color={colors.danger} accessibilityLiveRegion="assertive">
              {serverError}
            </Text>
          ) : null}
          <Button title={t("auth.login")} onPress={onSubmit} loading={formState.isSubmitting} />
        </Card>

        <View style={{ gap: spacing.md, alignItems: "center" }}>
          <Link href="/register" asChild>
            <Text color={colors.primary} variant="label" accessibilityRole="link">
              {t("auth.noAccount")}
            </Text>
          </Link>
          <Link href="/buyer" asChild>
            <Text muted accessibilityRole="link">
              {t("auth.browseAsGuest")}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
