import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { catalogApi } from "@/api/endpoints/catalog";
import { companiesApi } from "@/api/endpoints/companies";
import { getErrorMessage, getFieldErrors } from "@/api/errors";
import type { FabricRollCreate } from "@/api/types";
import { Button, Card, Chip, ColorDot, FormField, KeyValue, Row, Text } from "@/components/ui";
import { useBuyers, useCategories, useCreateRoll } from "@/hooks/queries";
import { formatBDT } from "@/lib/format";
import { HEX_COLOR_REGEX, rollSchema, type RollFormValues } from "@/lib/schemas";
import { useAuth } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { MIN_TOUCH, radius, spacing, useTheme } from "@/theme";

const SWATCHES: { name: string; hex: string }[] = [
  { name: "Deep Raw Indigo", hex: "#1E293B" },
  { name: "Navy Blue", hex: "#000080" },
  { name: "Optic White", hex: "#F8FAFC" },
  { name: "Jet Black", hex: "#0A0A0A" },
  { name: "Heather Grey", hex: "#9CA3AF" },
  { name: "Olive Green", hex: "#556B2F" },
  { name: "Sage Green", hex: "#8A9A86" },
  { name: "Khaki", hex: "#C3B091" },
  { name: "Maroon", hex: "#800000" },
  { name: "Mustard", hex: "#D4A017" },
  { name: "Dusty Pink", hex: "#D8A7B1" },
  { name: "Sky Blue", hex: "#87CEEB" },
];

const GRADES = ["GRADE_A", "GRADE_B", "SURPLUS_FRESH", "REMNANT"] as const;
const MAX_PHOTOS = 6;

/** A picked photo: shown at once from the phone, `url` is set once the upload finishes. */
type Photo = { key: string; asset: ImagePicker.ImagePickerAsset; url?: string; failed?: boolean };

const STEPS: { key: string; fields: FieldPath<RollFormValues>[] }[] = [
  { key: "type", fields: ["mode", "target_buyer_id", "buyer_spec_notes"] },
  { key: "fabric", fields: ["title", "fabric_type", "composition", "gsm", "width_inches", "quality_grade"] },
  { key: "color", fields: ["color_name", "color_hex"] },
  { key: "quantity", fields: ["total_yards", "min_cut_length_yards", "price_per_yard"] },
  { key: "photo", fields: ["image_url"] },
  { key: "review", fields: [] },
];

const DEFAULTS: RollFormValues = {
  mode: "PUBLIC",
  target_buyer_id: "",
  buyer_spec_notes: "",
  title: "",
  fabric_type: "",
  composition: "100% Cotton",
  gsm: "180",
  width_inches: "60",
  color_name: "",
  color_hex: "#",
  pattern: "Solid",
  finish: "",
  quality_grade: "GRADE_A",
  total_yards: "",
  min_cut_length_yards: "10",
  price_per_yard: "",
  lot_batch_number: "",
  defect_notes: "",
  image_url: "",
};

export default function NewListingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isAdmin = useAuth((s) => s.user?.role === "ADMIN");
  const [step, setStep] = useState(0);
  const [adminFactoryId, setAdminFactoryId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const uploading = photos.some((p) => !p.url && !p.failed);

  const uploadPhoto = async (photo: Photo) => {
    setPhotos((ps) => ps.map((p) => (p.key === photo.key ? { ...p, failed: false } : p)));
    try {
      const img = await catalogApi.uploadImage(photo.asset);
      setPhotos((ps) => ps.map((p) => (p.key === photo.key ? { ...p, url: img.url } : p)));
    } catch (err) {
      setPhotos((ps) => ps.map((p) => (p.key === photo.key ? { ...p, failed: true } : p)));
      Alert.alert(t("listing.uploadFailed"), getErrorMessage(err));
    }
  };

  const pickPhotos = async (fromCamera: boolean) => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      Alert.alert(t("listing.photoLimit"));
      return;
    }
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("listing.photos"), t("listing.photoPermission"));
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: !fromCamera,
      selectionLimit: room,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const added = result.assets.slice(0, room).map((asset, i) => ({ key: `${Date.now()}-${i}-${asset.uri}`, asset }));
    setPhotos((ps) => [...ps, ...added]);
    for (const photo of added) void uploadPhoto(photo);
  };

  const categories = useCategories();
  const buyers = useBuyers();
  const factories = useQuery({ queryKey: ["factories"], queryFn: companiesApi.factories, enabled: isAdmin });
  const createRoll = useCreateRoll();

  const { control, trigger, handleSubmit, setValue, setError, reset, getValues } = useForm<RollFormValues>({
    resolver: zodResolver(rollSchema),
    defaultValues: DEFAULTS,
    mode: "onTouched",
  });
  const values = useWatch({ control });
  const current = STEPS[step] ?? STEPS[0]!;

  // Opened from a buyer's sourcing request: start as a custom profile for that buyer.
  const params = useLocalSearchParams<{ buyerId?: string; title?: string; gsm?: string; yards?: string; notes?: string }>();
  useEffect(() => {
    if (!params.buyerId) return;
    reset({
      ...DEFAULTS,
      mode: "CUSTOM",
      target_buyer_id: params.buyerId,
      title: params.title ?? "",
      gsm: params.gsm || DEFAULTS.gsm,
      total_yards: params.yards ?? "",
      buyer_spec_notes: params.notes ?? "",
    });
    setStep(0);
  }, [params.buyerId, params.title, params.gsm, params.yards, params.notes, reset]);

  const next = async () => {
    if (step === 0 && isAdmin && !adminFactoryId) {
      Alert.alert(t("listing.pickFactoryTitle"), t("listing.pickFactoryBody"));
      return;
    }
    const ok = current.fields.length === 0 || (await trigger(current.fields));
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = handleSubmit(async (v) => {
    if (uploading) {
      Alert.alert(t("listing.photos"), t("listing.uploading"));
      return;
    }
    const payload: FabricRollCreate = {
      title: v.title.trim(),
      fabric_type: v.fabric_type,
      composition: v.composition.trim(),
      gsm: Number(v.gsm),
      width_inches: Number(v.width_inches),
      color_name: v.color_name.trim(),
      color_hex: v.color_hex.toUpperCase(),
      pattern: v.pattern?.trim() || undefined,
      finish: v.finish?.trim() || undefined,
      quality_grade: v.quality_grade,
      total_yards: Number(v.total_yards),
      min_cut_length_yards: Number(v.min_cut_length_yards),
      price_per_yard: Number(v.price_per_yard),
      lot_batch_number: v.lot_batch_number?.trim() || undefined,
      defect_notes: v.defect_notes?.trim() || undefined,
      image_url: v.image_url?.trim() || undefined,
      image_urls: photos.flatMap((p) => (p.url ? [p.url] : [])),
      target_buyer_id: v.mode === "CUSTOM" ? v.target_buyer_id || null : null,
      buyer_spec_notes: v.mode === "CUSTOM" ? v.buyer_spec_notes?.trim() : undefined,
      factory_id: isAdmin ? adminFactoryId ?? undefined : undefined,
    };
    try {
      const { roll, message } = await createRoll.mutateAsync(payload);
      Alert.alert(t("listing.successTitle"), message);
      reset(DEFAULTS);
      setPhotos([]);
      setStep(0);
      router.push({ pathname: "/roll/[id]", params: { id: roll.id } });
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      const keys = Object.keys(fieldErrors);
      for (const key of keys) {
        if (key in DEFAULTS) setError(key as FieldPath<RollFormValues>, { message: fieldErrors[key] });
      }
      // Jump back to the first step that has a server-side error.
      const badStep = STEPS.findIndex((s) => s.fields.some((f) => keys.includes(f)));
      if (badStep >= 0) setStep(badStep);
      Alert.alert(t("common.errorTitle"), getErrorMessage(err));
    }
  });

  const fabricTypes = (categories.data ?? []).flatMap((c) => c.fabric_types.map((ft) => ({ ...ft, category: c.name })));
  const selectedType = fabricTypes.find((ft) => ft.id === values.fabric_type);
  const selectedBuyer = buyers.data?.find((b) => b.id === values.target_buyer_id);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      {/* Progress */}
      <View style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="label">{t(`listing.steps.${current.key}`)}</Text>
          <Text variant="caption" muted numeric>
            {t("listing.stepOf", { current: step + 1, total: STEPS.length })}
          </Text>
        </Row>
        <Row style={{ gap: 4 }}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.primary : colors.border }} />
          ))}
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <Card style={{ gap: spacing.lg }}>
            {isAdmin ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{t("listing.onBehalfOf")}</Text>
                <Row style={{ flexWrap: "wrap" }}>
                  {(factories.data ?? []).map((f) => (
                    <Chip key={f.id} label={f.name} selected={adminFactoryId === f.id} onPress={() => setAdminFactoryId(f.id)} />
                  ))}
                </Row>
              </View>
            ) : null}
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <View style={{ gap: spacing.md }}>
                  <ModeOption
                    selected={field.value === "PUBLIC"}
                    icon="storefront-outline"
                    title={t("listing.public")}
                    body={t("listing.publicBody")}
                    onPress={() => field.onChange("PUBLIC")}
                  />
                  <ModeOption
                    selected={field.value === "CUSTOM"}
                    icon="sparkles-outline"
                    title={t("listing.custom")}
                    body={t("listing.customBody")}
                    onPress={() => field.onChange("CUSTOM")}
                  />
                </View>
              )}
            />
            {values.mode === "CUSTOM" ? (
              <Controller
                control={control}
                name="target_buyer_id"
                render={({ field, fieldState }) => (
                  <View style={{ gap: spacing.sm }}>
                    <Text variant="label">{t("listing.targetBuyer")}</Text>
                    {buyers.isPending ? <Text muted>{t("common.loading")}</Text> : null}
                    <Row style={{ flexWrap: "wrap" }}>
                      {(buyers.data ?? []).map((b) => (
                        <Chip key={b.id} label={b.name} selected={field.value === b.id} onPress={() => field.onChange(b.id)} />
                      ))}
                    </Row>
                    {fieldState.error?.message ? (
                      <Text variant="caption" color={colors.danger}>
                        {t(fieldState.error.message)}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            ) : null}
            {values.mode === "CUSTOM" ? (
              <FormField control={control} name="buyer_spec_notes" label={t("listing.specNotes")} multiline />
            ) : null}
          </Card>
        ) : null}

        {step === 1 ? (
          <Card style={{ gap: spacing.lg }}>
            <FormField control={control} name="title" label={t("listing.title")} placeholder={t("listing.titlePlaceholder")} />
            <Controller
              control={control}
              name="fabric_type"
              render={({ field, fieldState }) => (
                <View style={{ gap: spacing.sm }}>
                  <Text variant="label">{t("listing.fabricType")}</Text>
                  <Row style={{ flexWrap: "wrap" }}>
                    {fabricTypes.map((ft) => (
                      <Chip key={ft.id} label={ft.name} selected={field.value === ft.id} onPress={() => field.onChange(ft.id)} />
                    ))}
                  </Row>
                  {fieldState.error?.message ? (
                    <Text variant="caption" color={colors.danger}>
                      {t(fieldState.error.message)}
                    </Text>
                  ) : null}
                </View>
              )}
            />
            <FormField control={control} name="composition" label={t("roll.composition")} />
            <Row style={{ gap: spacing.md, alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <FormField control={control} name="gsm" label="GSM" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField control={control} name="width_inches" label={t("listing.widthInches")} keyboardType="decimal-pad" />
              </View>
            </Row>
            <Row style={{ gap: spacing.md, alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <FormField control={control} name="pattern" label={t("roll.pattern")} />
              </View>
              <View style={{ flex: 1 }}>
                <FormField control={control} name="finish" label={t("roll.finish")} />
              </View>
            </Row>
            <Controller
              control={control}
              name="quality_grade"
              render={({ field }) => (
                <View style={{ gap: spacing.sm }}>
                  <Text variant="label">{t("listing.grade")}</Text>
                  <Row style={{ flexWrap: "wrap" }}>
                    {GRADES.map((g) => (
                      <Chip key={g} label={t(`grade.${g}`)} selected={field.value === g} onPress={() => field.onChange(g)} />
                    ))}
                  </Row>
                </View>
              )}
            />
          </Card>
        ) : null}

        {step === 2 ? (
          <Card style={{ gap: spacing.lg }}>
            <Text variant="label">{t("listing.swatches")}</Text>
            <View style={styles.swatchGrid}>
              {SWATCHES.map((s) => {
                const selected = values.color_hex?.toUpperCase() === s.hex.toUpperCase();
                return (
                  <Pressable
                    key={s.hex}
                    accessibilityRole="button"
                    accessibilityLabel={s.name}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setValue("color_name", s.name, { shouldValidate: true });
                      setValue("color_hex", s.hex, { shouldValidate: true });
                    }}
                    style={[styles.swatch, { backgroundColor: s.hex, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 3 : 1 }]}
                  />
                );
              })}
            </View>
            <FormField control={control} name="color_name" label={t("roll.color")} />
            <Row style={{ alignItems: "flex-end", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FormField control={control} name="color_hex" label={t("listing.hex")} autoCapitalize="characters" maxLength={7} />
              </View>
              {HEX_COLOR_REGEX.test(values.color_hex ?? "") ? <ColorDot hex={values.color_hex as string} size={MIN_TOUCH} /> : null}
            </Row>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card style={{ gap: spacing.lg }}>
            <FormField control={control} name="total_yards" label={t("listing.totalYards")} keyboardType="decimal-pad" />
            <FormField control={control} name="min_cut_length_yards" label={t("roll.minCut")} keyboardType="decimal-pad" hint={t("listing.minCutHint")} />
            <FormField control={control} name="price_per_yard" label={t("listing.pricePerYard")} keyboardType="decimal-pad" />
            <FormField control={control} name="lot_batch_number" label={t("roll.lot")} />
            <FormField control={control} name="defect_notes" label={t("roll.defects")} multiline />
          </Card>
        ) : null}

        {step === 4 ? (
          <Card style={{ gap: spacing.lg }}>
            <View style={{ gap: 4 }}>
              <Text variant="label">{t("listing.photos")}</Text>
              <Text variant="caption" muted>
                {t("listing.photosHint")}
              </Text>
            </View>
            <Row style={{ gap: spacing.md }}>
              <Button
                title={t("listing.takePhoto")}
                variant="secondary"
                icon={<Ionicons name="camera-outline" size={18} color={colors.text} />}
                onPress={() => void pickPhotos(true)}
                disabled={photos.length >= MAX_PHOTOS}
                style={{ flex: 1 }}
              />
              <Button
                title={t("listing.pickPhotos")}
                variant="secondary"
                icon={<Ionicons name="images-outline" size={18} color={colors.text} />}
                onPress={() => void pickPhotos(false)}
                disabled={photos.length >= MAX_PHOTOS}
                style={{ flex: 1 }}
              />
            </Row>

            {photos.length ? (
              <View style={styles.photoGrid}>
                {photos.map((p, i) => (
                  <View key={p.key} style={styles.photoCell}>
                    <Pressable
                      style={styles.photo}
                      onPress={p.failed ? () => void uploadPhoto(p) : undefined}
                      accessibilityRole={p.failed ? "button" : "image"}
                      accessibilityLabel={p.failed ? t("common.retry") : `${t("listing.photos")} ${i + 1}`}
                    >
                      <Image source={{ uri: p.asset.uri }} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
                      {!p.url ? (
                        <View style={[styles.photoOverlay, { backgroundColor: p.failed ? "rgba(160,30,30,0.6)" : "rgba(0,0,0,0.45)" }]}>
                          {p.failed ? (
                            <Ionicons name="refresh" size={26} color="#fff" />
                          ) : (
                            <ActivityIndicator color="#fff" />
                          )}
                        </View>
                      ) : null}
                    </Pressable>
                    {i === 0 ? (
                      <View style={[styles.coverTag, { backgroundColor: colors.primary }]}>
                        <Text variant="caption" color={colors.primaryText} style={{ fontWeight: "700" }}>
                          {t("listing.cover")}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => setPhotos((ps) => ps.filter((x) => x.key !== p.key))}
                      accessibilityRole="button"
                      accessibilityLabel={t("listing.removePhoto", { n: i + 1 })}
                      hitSlop={10}
                      style={[styles.removeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Ionicons name="close" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.preview, { backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", gap: spacing.sm }]}>
                <Ionicons name="image-outline" size={40} color={colors.textMuted} />
                <Text variant="caption" muted center style={{ paddingHorizontal: spacing.lg }}>
                  {t("listing.imageHint")}
                </Text>
              </View>
            )}
            {uploading ? (
              <Text variant="caption" muted>
                {t("listing.uploading")}
              </Text>
            ) : null}

            <FormField
              control={control}
              name="image_url"
              label={t("listing.orLink")}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://…"
            />
          </Card>
        ) : null}

        {step === 5 ? (
          <Card style={{ gap: 2 }}>
            <Text variant="subheading" style={{ marginBottom: spacing.sm }}>
              {getValues("title")}
            </Text>
            <KeyValue label={t("listing.listingType")} value={values.mode === "CUSTOM" ? t("listing.customFor", { buyer: selectedBuyer?.name ?? "" }) : t("listing.public")} />
            <KeyValue label={t("listing.fabricType")} value={selectedType ? `${selectedType.name} (${selectedType.category})` : "—"} />
            <KeyValue label={t("roll.composition")} value={values.composition ?? ""} />
            <KeyValue label="GSM / width" value={`${values.gsm} / ${values.width_inches}"`} />
            <Row style={{ justifyContent: "space-between", paddingVertical: 3 }}>
              <Text muted>{t("roll.color")}</Text>
              <Row style={{ gap: 6 }}>
                {HEX_COLOR_REGEX.test(values.color_hex ?? "") ? <ColorDot hex={values.color_hex as string} /> : null}
                <Text>{values.color_name}</Text>
              </Row>
            </Row>
            <KeyValue label={t("listing.totalYards")} value={`${values.total_yards} ${t("common.yd")}`} />
            <KeyValue label={t("roll.minCut")} value={`${values.min_cut_length_yards} ${t("common.yd")}`} />
            <KeyValue label={t("listing.pricePerYard")} value={formatBDT(values.price_per_yard ?? 0)} />
            <KeyValue label={t("listing.grade")} value={t(`grade.${values.quality_grade}`)} />
            <KeyValue
              label={t("listing.photos")}
              value={t("listing.photoCount", { count: photos.filter((p) => p.url).length + (values.image_url?.trim() ? 1 : 0) })}
            />
          </Card>
        ) : null}

        <Row style={{ gap: spacing.md }}>
          {step > 0 ? (
            <Button title={t("common.back")} variant="secondary" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button title={t("common.next")} onPress={() => void next()} style={{ flex: 1 }} />
          ) : (
            <Button title={t("listing.publish")} onPress={() => void submit()} loading={createRoll.isPending} style={{ flex: 1 }} />
          )}
        </Row>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModeOption({
  selected,
  icon,
  title,
  body,
  onPress,
}: {
  selected: boolean;
  icon: "storefront-outline" | "sparkles-outline";
  title: string;
  body: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.mode,
        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface },
      ]}
    >
      <Ionicons name={icon} size={24} color={selected ? colors.primary : colors.textMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        <Text variant="caption" muted>
          {body}
        </Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  swatch: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.md },
  preview: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoCell: { width: "31%", aspectRatio: 1 },
  photo: { width: "100%", height: "100%", borderRadius: radius.md },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  coverTag: { position: "absolute", left: 4, bottom: 4, paddingHorizontal: 6, borderRadius: radius.sm },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  mode: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md },
});
