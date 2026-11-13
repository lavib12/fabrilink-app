import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { type ComponentProps, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { authApi } from "@/api/endpoints/auth";
import { getErrorMessage } from "@/api/errors";
import { Badge, Button, Card, Chip, KeyValue, Row, Text, type Tone } from "@/components/ui";
import { API_BASE_URL } from "@/config";
import type { Language } from "@/i18n";
import { formatBDT } from "@/lib/format";
import { needsKyc } from "@/lib/routing";
import { useAuth } from "@/store/auth";
import { MIN_TOUCH, spacing, useTheme } from "@/theme";

const VERIFICATION_TONE: Record<string, Tone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

function LinkRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: MIN_TOUCH + 8,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={{ flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const refreshUser = useAuth((s) => s.refreshUser);
  const [savingLang, setSavingLang] = useState(false);

  const setLanguage = async (lang: Language) => {
    await i18n.changeLanguage(lang);
    if (!user) return;
    setSavingLang(true);
    try {
      await authApi.updateProfile({ preferred_language: lang });
      await refreshUser();
    } catch (err) {
      Alert.alert(t("common.errorTitle"), getErrorMessage(err));
    } finally {
      setSavingLang(false);
    }
  };

  const languageCard = (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="label">{t("profile.language")}</Text>
      <Row>
        <Chip label="বাংলা" selected={i18n.language === "bn"} onPress={() => void setLanguage("bn")} />
        <Chip label="English" selected={i18n.language === "en"} onPress={() => void setLanguage("en")} />
        {savingLang ? <Text variant="caption" muted>…</Text> : null}
      </Row>
    </Card>
  );

  if (!user) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ gap: spacing.md, alignItems: "center" }}>
          <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
          <Text variant="subheading" center>
            {t("profile.guestTitle")}
          </Text>
          <Text muted center>
            {t("profile.guestMessage")}
          </Text>
          <Button title={t("auth.login")} onPress={() => router.push("/login")} />
          <Button title={t("auth.createAccount")} variant="secondary" onPress={() => router.push("/register")} />
        </Card>
        {languageCard}
      </ScrollView>
    );
  }

  const company = user.company;
  const fullName = user.profile?.full_name || user.email;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card style={{ gap: spacing.sm }}>
        <Row>
          <Ionicons name="person-circle" size={48} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">{fullName}</Text>
            <Text muted>{t(`roles.${user.role}`)}</Text>
          </View>
        </Row>
        <KeyValue label={t("auth.email")} value={user.email} />
        <KeyValue label={t("auth.phone")} value={user.phone} />
      </Card>

      {company ? (
        <Card style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="subheading" style={{ flex: 1 }}>
              {company.name}
            </Text>
            <Badge label={t(`verification.${company.verification_status}`)} tone={VERIFICATION_TONE[company.verification_status] ?? "neutral"} />
          </Row>
          {Number(company.credit_limit) > 0 ? (
            <KeyValue label={t("profile.creditLimit")} value={formatBDT(company.credit_limit)} />
          ) : null}
          {needsKyc(user) ? (
            <Button title={t("kyc.goToKyc")} variant="secondary" onPress={() => router.push("/pending-approval")} />
          ) : null}
        </Card>
      ) : null}

      <Card style={{ paddingVertical: spacing.xs }}>
        {user.role === "BUYER" ? (
          <>
            <LinkRow icon="search-outline" label={t("profile.linkRequests")} onPress={() => router.push("/requests")} />
            <LinkRow icon="wallet-outline" label={t("profile.linkCredit")} onPress={() => router.push("/credit")} last />
          </>
        ) : null}
        {user.role === "FACTORY" ? (
          <>
            <LinkRow icon="megaphone-outline" label={t("profile.linkBuyerRequests")} onPress={() => router.push("/requests")} />
            {company ? (
              <LinkRow
                icon="storefront-outline"
                label={t("factory.myStorefront")}
                onPress={() => router.push({ pathname: "/mill/[id]", params: { id: company.id } })}
                last
              />
            ) : null}
          </>
        ) : null}
        {user.role === "ADMIN" ? (
          <LinkRow icon="search-outline" label={t("profile.linkAllRequests")} onPress={() => router.push("/requests")} last />
        ) : null}
        {user.role === "HUB_STAFF" ? (
          <LinkRow icon="barcode-outline" label={t("tabs.scan")} onPress={() => router.navigate("/hub/scan")} last />
        ) : null}
      </Card>

      {languageCard}

      <Button
        title={t("profile.logout")}
        variant="danger"
        onPress={() =>
          Alert.alert(t("profile.logoutConfirm"), undefined, [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("profile.logout"),
              style: "destructive",
              onPress: () => void logout().then(() => router.replace("/buyer")),
            },
          ])
        }
      />

      <Text variant="caption" muted center>
        FabriLink {Constants.expoConfig?.version ?? ""}
        {__DEV__ ? `\n${API_BASE_URL}` : ""}
      </Text>
    </ScrollView>
  );
}
