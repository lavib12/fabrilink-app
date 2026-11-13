import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";

import type { FabricRollListItem } from "@/api/types";
import { RollCard } from "@/components/RollCard";
import { CardSkeletonGrid, Chip, EmptyState, ErrorState } from "@/components/ui";
import { useRolls } from "@/hooks/queries";
import { spacing } from "@/theme";

type Segment = "ALL" | "PUBLIC" | "CUSTOM" | "SOLD_OUT";

const MINE = { mine: true } as const;

const SEGMENT_FILTER: Record<Segment, (r: FabricRollListItem) => boolean> = {
  ALL: () => true,
  PUBLIC: (r) => !r.is_custom_profile && r.status !== "SOLD_OUT",
  CUSTOM: (r) => r.is_custom_profile,
  SOLD_OUT: (r) => r.status === "SOLD_OUT",
};

export default function FactoryStockScreen() {
  const { t } = useTranslation();
  const rolls = useRolls(MINE);
  const [segment, setSegment] = useState<Segment>("ALL");

  const data = useMemo(() => (rolls.data ?? []).filter(SEGMENT_FILTER[segment]), [rolls.data, segment]);
  const counts = useMemo(() => {
    const all = rolls.data ?? [];
    return Object.fromEntries(
      (Object.keys(SEGMENT_FILTER) as Segment[]).map((s) => [s, all.filter(SEGMENT_FILTER[s]).length])
    ) as Record<Segment, number>;
  }, [rolls.data]);

  return (
    <FlatList
      data={rolls.isPending ? [] : data}
      keyExtractor={(r) => r.id}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.md }}
      contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
      ListHeaderComponent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, padding: spacing.md, paddingBottom: 0 }}>
          {(Object.keys(SEGMENT_FILTER) as Segment[]).map((s) => (
            <Chip key={s} label={`${t(`stock.${s}`)} (${counts[s]})`} selected={segment === s} onPress={() => setSegment(s)} />
          ))}
        </ScrollView>
      }
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: "50%" }}>
          <RollCard roll={item} showStatus />
        </View>
      )}
      ListEmptyComponent={
        rolls.isPending ? (
          <CardSkeletonGrid count={4} />
        ) : rolls.isError ? (
          <ErrorState error={rolls.error} onRetry={() => void rolls.refetch()} />
        ) : (
          <EmptyState
            icon="layers-outline"
            title={t("stock.emptyTitle")}
            actionLabel={t("factory.newListing")}
            onAction={() => router.navigate("/factory/new-listing")}
          />
        )
      }
      refreshControl={<RefreshControl refreshing={rolls.isRefetching} onRefresh={() => void rolls.refetch()} />}
    />
  );
}
