import { zodResolver } from "@hookform/resolvers/zod";
import { router, Stack } from "expo-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { getFieldErrors } from "@/api/errors";
import { Button, Card, FormField, Text } from "@/components/ui";
import { useCreateSourcingRequest } from "@/hooks/queries";
import { showPurchaseError } from "@/lib/purchaseErrors";
import { sourcingRequestSchema, type SourcingRequestValues } from "@/lib/schemas";
import { spacing } from "@/theme";

const FIELDS = ["fabric_name", "target_gsm", "required_yards", "color_preference", "notes"] as const;

export default function NewSourcingRequestScreen() {
  const { t } = useTranslation();
  const create = useCreateSourcingRequest();
  const { control, handleSubmit, setError } = useForm<SourcingRequestValues>({
    resolver: zodResolver(sourcingRequestSchema),
    defaultValues: { fabric_name: "", target_gsm: "", required_yards: "", color_preference: "", notes: "" },
  });

  const submit = handleSubmit(async (v) => {
    try {
      const req = await create.mutateAsync({
        fabric_name: v.fabric_name,
        target_gsm: v.target_gsm ? Number(v.target_gsm) : null,
        required_yards: v.required_yards ? Number(v.required_yards).toFixed(2) : null,
        color_preference: v.color_preference ?? "",
        notes: v.notes ?? "",
      });
      router.replace({ pathname: "/requests/[id]", params: { id: req.id } });
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      let mapped = false;
      for (const f of FIELDS) {
        if (fieldErrors[f]) {
          setError(f, { message: fieldErrors[f] });
          mapped = true;
        }
      }
      // Field errors show inline; anything else (e.g. KYC not approved) gets a dialog.
      if (!mapped) showPurchaseError(err, t);
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t("requests.new") }} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text muted>{t("requests.formIntro")}</Text>
        <Card style={{ gap: spacing.lg }}>
          <FormField
            control={control}
            name="fabric_name"
            label={t("requests.fabricName")}
            placeholder={t("requests.fabricNamePlaceholder")}
          />
          <FormField control={control} name="target_gsm" label={t("requests.targetGsm")} keyboardType="number-pad" placeholder="180" />
          <FormField control={control} name="required_yards" label={t("requests.requiredYards")} keyboardType="decimal-pad" placeholder="50" />
          <FormField
            control={control}
            name="color_preference"
            label={t("requests.color")}
            placeholder={t("requests.colorPlaceholder")}
          />
          <FormField
            control={control}
            name="notes"
            label={t("requests.notes")}
            placeholder={t("requests.notesPlaceholder")}
            multiline
          />
          <Button title={t("requests.post")} onPress={() => void submit()} loading={create.isPending} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
