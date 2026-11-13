import { zodResolver } from "@hookform/resolvers/zod";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { getErrorMessage, getFieldErrors } from "@/api/errors";
import { Button, Card, Chip, FormField, Row, Text } from "@/components/ui";
import { homeRouteFor } from "@/lib/routing";
import { registerSchema, type RegisterValues } from "@/lib/schemas";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

const FIELDS = ["company_name", "first_name", "last_name", "email", "phone", "password"] as const;

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const register = useAuth((s) => s.register);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, setError, formState } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "BUYER",
      company_name: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const submit = handleSubmit(async (raw) => {
    setServerError(null);
    const values = registerSchema.parse(raw);
    try {
      const user = await register({
        ...values,
        preferred_language: i18n.language === "en" ? "en" : "bn",
      });
      router.replace(homeRouteFor(user) as Href);
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      let mapped = false;
      for (const field of FIELDS) {
        if (fieldErrors[field]) {
          setError(field, { message: fieldErrors[field] });
          mapped = true;
        }
      }
      if (!mapped) setServerError(getErrorMessage(err));
    }
  });
  const onSubmit = () => void submit();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text muted>{t("auth.registerSubtitle")}</Text>

        <Card style={{ gap: spacing.lg }}>
          <Text variant="label">{t("auth.iAmA")}</Text>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Row style={{ flexWrap: "wrap" }}>
                <Chip label={t("auth.roleBuyer")} selected={field.value === "BUYER"} onPress={() => field.onChange("BUYER")} />
                <Chip label={t("auth.roleFactory")} selected={field.value === "FACTORY"} onPress={() => field.onChange("FACTORY")} />
              </Row>
            )}
          />
          <FormField control={control} name="company_name" label={t("auth.companyName")} />
          <FormField control={control} name="first_name" label={t("auth.firstName")} />
          <FormField control={control} name="last_name" label={t("auth.lastName")} />
          <FormField
            control={control}
            name="email"
            label={t("auth.email")}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <FormField
            control={control}
            name="phone"
            label={t("auth.phone")}
            keyboardType="phone-pad"
            placeholder="01711223344"
            hint={t("auth.phoneHint")}
          />
          <FormField
            control={control}
            name="password"
            label={t("auth.password")}
            secureTextEntry
            autoComplete="new-password"
            hint={t("auth.passwordHint")}
          />
          {serverError ? <Text color={colors.danger}>{serverError}</Text> : null}
          <Button title={t("auth.createAccount")} onPress={onSubmit} loading={formState.isSubmitting} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
