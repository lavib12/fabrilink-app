import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { CatalogBrowser } from "@/components/CatalogBrowser";
import { Card, Text } from "@/components/ui";
import { spacing, useTheme } from "@/theme";

const EXCLUSIVE_FILTERS = { custom_only: true } as const;

export default function ExclusiveScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <CatalogBrowser
      baseFilters={EXCLUSIVE_FILTERS}
      emptyTitle={t("exclusive.emptyTitle")}
      emptyMessage={t("exclusive.emptyMessage")}
      header={
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <Card style={{ backgroundColor: colors.exclusiveSoft, borderColor: colors.exclusive, gap: 4 }}>
            <Text variant="subheading" color={colors.exclusive}>
              {t("exclusive.title")}
            </Text>
            <Text muted>{t("exclusive.subtitle")}</Text>
          </Card>
        </View>
      }
    />
  );
}
