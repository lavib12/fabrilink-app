import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, Platform } from "react-native";

/**
 * Pulls new app versions published with `eas update` so installed phones get new
 * features without a new APK. Checks on start and whenever the app comes back to the
 * foreground; when a new version has downloaded, offers to restart into it.
 */
export function useOtaUpdates() {
  const { t } = useTranslation();
  const asking = useRef(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) return;

    const check = async () => {
      if (asking.current) return;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        asking.current = true;
        Alert.alert(t("update.title"), t("update.body"), [
          { text: t("update.later"), style: "cancel", onPress: () => (asking.current = false) },
          { text: t("update.restart"), onPress: () => void Updates.reloadAsync() },
        ]);
      } catch {
        // Offline or the update server is unreachable: try again next time.
      }
    };

    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, [t]);
}
