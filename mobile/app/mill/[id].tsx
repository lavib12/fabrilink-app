import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { CatalogBrowser } from "@/components/CatalogBrowser";
import { Badge, Card, ErrorState, LoadingState, Row, Text } from "@/components/ui";
import { useFactory } from "@/hooks/queries";
import { formatNumber } from "@/lib/format";
import { spacing, useTheme } from "@/theme";

export default function MillStorefrontScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const factory = useFactory(id);
  const filters = useMemo(() => ({ factory_id: id }), [id]);

  if (factory.isPending) return <LoadingState />;
  if (factory.isError || !factory.data) return <ErrorState error={factory.error} onRetry={() => void factory.refetch()} />;

  const f = factory.data;
  const address = f.addresses.find((a) => a.is_default) ?? f.addresses[0];

  return (
    <>
      <Stack.Screen options={{ title: f.name }} />
      <CatalogBrowser
        baseFilters={filters}
        emptyTitle={t("mill.emptyTitle")}
        header={
          <View style={{ padding: spacing.md, paddingBottom: 0 }}>
            <Card style={{ gap: spacing.md }}>
              <Row>
                <Ionicons name="business" size={28} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{f.name}</Text>
                  {address ? (
                    <Text variant="caption" muted>
                      {address.street_address}, {address.district}, {address.division}
                    </Text>
                  ) : null}
                </View>
                <Badge label={t("mill.verified")} tone="success" />
              </Row>
              <Row style={{ justifyContent: "space-around" }}>
                <Stat label={t("mill.activeRolls")} value={String(f.stats.total_active_rolls)} />
                <Stat label={t("mill.yardsAvailable")} value={formatNumber(f.stats.total_available_yards, 0)} />
                <Stat label={t("mill.fabricTypes")} value={String(f.stats.fabric_types_count)} />
              </Row>
              {f.stats.custom_profiles_count_for_you > 0 ? (
                <Badge label={t("mill.exclusiveForYou", { count: f.stats.custom_profiles_count_for_you })} tone="exclusive" />
              ) : null}
            </Card>
          </View>
        }
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text variant="subheading">{value}</Text>
      <Text variant="caption" muted center>
        {label}
      </Text>
    </View>
  );
}
