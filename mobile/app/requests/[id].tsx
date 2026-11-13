import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, RefreshControl, ScrollView, View } from "react-native";

import { getErrorMessage } from "@/api/errors";
import { RollCard } from "@/components/RollCard";
import { useRequestSpecs } from "@/components/SourcingRequestCard";
import { Badge, Button, Card, ErrorState, KeyValue, LoadingState, Text } from "@/components/ui";
import { useCloseSourcingRequest, useSourcingMatches, useSourcingRequest } from "@/hooks/queries";
import { formatDate, formatNumber } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

export default function SourcingRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const request = useSourcingRequest(id);
  const isOwner = Boolean(request.data && user?.company?.id === request.data.buyer_id);
  const matches = useSourcingMatches(id, isOwner);
  const close = useCloseSourcingRequest();
  const specs = useRequestSpecs(
    request.data ?? {
      id: "",
      buyer_id: "",
      buyer_name: "",
      fabric_name: "",
      target_gsm: null,
      required_yards: null,
      color_preference: "",
      notes: "",
      status: "OPEN",
      created_at: "",
      updated_at: "",
    }
  );

  if (request.isPending) return <LoadingState />;
  if (request.isError || !request.data) return <ErrorState error={request.error} onRetry={() => void request.refetch()} />;

  const r = request.data;
  const isOpen = r.status === "OPEN";

  const onClose = (fulfilled: boolean) =>
    Alert.alert(fulfilled ? t("requests.markFulfilled") : t("requests.close"), t("requests.closeBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: () =>
          close.mutate(
            { id: r.id, fulfilled },
            { onError: (err) => Alert.alert(t("common.errorTitle"), getErrorMessage(err)) }
          ),
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: t("requests.detailTitle") }} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={request.isRefetching || matches.isRefetching}
            onRefresh={() => {
              void request.refetch();
              if (isOwner) void matches.refetch();
            }}
          />
        }
      >
        <Card style={{ gap: spacing.sm }}>
          <Badge
            label={t(`requests.status.${r.status}`)}
            tone={r.status === "OPEN" ? "success" : r.status === "FULFILLED" ? "primary" : "neutral"}
          />
          <Text variant="heading">{r.fabric_name}</Text>
          <Text muted numeric>
            {specs}
          </Text>
          {r.notes ? <Text>{r.notes}</Text> : null}
          <KeyValue label={t("requests.buyer")} value={r.buyer_name} />
          <KeyValue label={t("requests.postedOn")} value={formatDate(r.created_at)} />
        </Card>

        {/* Factories turn a request into a custom profile for that buyer. */}
        {user?.role === "FACTORY" && isOpen ? (
          <Card style={{ gap: spacing.md, backgroundColor: colors.exclusiveSoft, borderColor: colors.exclusive }}>
            <Text variant="label" color={colors.exclusive}>
              {t("requests.factoryCta", { buyer: r.buyer_name })}
            </Text>
            <Button
              title={t("requests.buildProfile")}
              onPress={() =>
                router.push({
                  pathname: "/factory/new-listing",
                  params: {
                    buyerId: r.buyer_id,
                    title: r.fabric_name,
                    gsm: r.target_gsm ? String(r.target_gsm) : "",
                    yards: r.required_yards ? String(Number(r.required_yards)) : "",
                    notes: t("requests.profileNote", { fabric: r.fabric_name }) + (r.notes ? ` ${r.notes}` : ""),
                  },
                })
              }
            />
          </Card>
        ) : null}

        {isOwner ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="subheading">{t("requests.matchesTitle")}</Text>
            <Text muted>{t("requests.matchesIntro")}</Text>
            {matches.isPending ? (
              <LoadingState />
            ) : matches.isError ? (
              <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />
            ) : matches.data.length === 0 ? (
              <Card>
                <Text muted>{t("requests.noMatches")}</Text>
              </Card>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                {matches.data.map((roll) => (
                  <View key={roll.id} style={{ width: "47.5%" }}>
                    <RollCard roll={roll} />
                  </View>
                ))}
              </View>
            )}
            {matches.data?.length ? (
              <Text variant="caption" muted numeric>
                {t("requests.matchCount", { count: matches.data.length, n: formatNumber(matches.data.length, 0) })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {isOwner && isOpen ? (
          <View style={{ gap: spacing.sm }}>
            <Button title={t("requests.markFulfilled")} variant="secondary" onPress={() => onClose(true)} loading={close.isPending} />
            <Button title={t("requests.close")} variant="ghost" onPress={() => onClose(false)} />
          </View>
        ) : null}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </>
  );
}
