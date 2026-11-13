import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { Button, Card, EmptyState, Text, TextField } from "@/components/ui";
import { useOrders } from "@/hooks/queries";
import { radius, spacing, useTheme } from "@/theme";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ScanScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const orders = useOrders();
  const [manual, setManual] = useState("");
  const [active, setActive] = useState(false);
  const lastScan = useRef<{ value: string; at: number } | null>(null);

  // Only run the camera while this tab is focused (saves battery, frees the camera).
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, [])
  );

  const openCode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const list = orders.data ?? [];
    const match = list.find((o) => o.order_number.toUpperCase() === code.toUpperCase() || o.id === code);
    if (match) {
      router.push({ pathname: "/order/[id]", params: { id: match.id } });
    } else if (UUID_RE.test(code)) {
      router.push({ pathname: "/order/[id]", params: { id: code } });
    } else {
      Alert.alert(t("scan.notFoundTitle"), t("scan.notFoundBody", { code }));
    }
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const now = Date.now();
    // Ignore repeated frames of the same code.
    if (lastScan.current && lastScan.current.value === data && now - lastScan.current.at < 3000) return;
    lastScan.current = { value: data, at: now };
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    openCode(data);
  };

  return (
    <View style={{ flex: 1, padding: spacing.md, gap: spacing.md }}>
      {!permission ? null : !permission.granted ? (
        <Card style={{ flex: 1 }}>
          <EmptyState
            icon="camera-outline"
            title={t("scan.permissionTitle")}
            message={t("scan.permissionBody")}
            actionLabel={t("scan.allowCamera")}
            onAction={() => void requestPermission()}
          />
        </Card>
      ) : (
        <View style={[styles.cameraWrap, { borderColor: colors.border }]}>
          {active ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13"] }}
              onBarcodeScanned={onScanned}
            />
          ) : null}
          <View style={[styles.reticle, { borderColor: colors.primary }]} pointerEvents="none" />
        </View>
      )}

      <Text muted center>
        {t("scan.hint")}
      </Text>
      <TextField
        label={t("scan.manual")}
        value={manual}
        onChangeText={setManual}
        autoCapitalize="characters"
        placeholder="ORD-XXXXXXXX"
        onSubmitEditing={() => openCode(manual)}
        returnKeyType="go"
      />
      <Button title={t("scan.open")} onPress={() => openCode(manual)} disabled={!manual.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { flex: 1, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, minHeight: 260, backgroundColor: "#000" },
  reticle: {
    position: "absolute",
    top: "25%",
    left: "12%",
    right: "12%",
    bottom: "25%",
    borderWidth: 3,
    borderRadius: radius.md,
  },
});
