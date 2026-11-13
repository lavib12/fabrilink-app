import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";

import type { FabricRollListItem, RollFilters } from "@/api/types";
import { useCategories, useRolls } from "@/hooks/queries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toNumber } from "@/lib/format";
import { MIN_TOUCH, radius, spacing, useTheme } from "@/theme";

import { RollCard } from "./RollCard";
import { Button, CardSkeletonGrid, Chip, EmptyState, ErrorState, Row, Sheet, Text, TextField } from "./ui";

type GsmBand = "all" | "light" | "mid" | "heavy";
type SortKey = "newest" | "price_asc" | "price_desc" | "yards_desc";

const GSM_BANDS: Record<GsmBand, Pick<RollFilters, "min_gsm" | "max_gsm">> = {
  all: {},
  light: { max_gsm: 200 },
  mid: { min_gsm: 201, max_gsm: 300 },
  heavy: { min_gsm: 301 },
};

function sortRolls(rolls: FabricRollListItem[], key: SortKey) {
  const copy = [...rolls];
  switch (key) {
    case "price_asc":
      return copy.sort((a, b) => toNumber(a.price_per_yard) - toNumber(b.price_per_yard));
    case "price_desc":
      return copy.sort((a, b) => toNumber(b.price_per_yard) - toNumber(a.price_per_yard));
    case "yards_desc":
      return copy.sort((a, b) => toNumber(b.available_yards) - toNumber(a.available_yards));
    default:
      return copy;
  }
}

/**
 * Search + filter + grid of rolls. `baseFilters` pins scope (e.g. a mill's store,
 * custom profiles only, or a factory's own stock).
 */
export function CatalogBrowser({
  baseFilters = {},
  header,
  showStatus = false,
  emptyTitle,
  emptyMessage,
}: {
  baseFilters?: RollFilters;
  header?: ReactElement;
  showStatus?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const categories = useCategories();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [fabricType, setFabricType] = useState<string | undefined>();
  const [gsm, setGsm] = useState<GsmBand>("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [color, setColor] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const debouncedColor = useDebouncedValue(color.trim(), 300);
  const priceNumber = toNumber(maxPrice);

  const filters: RollFilters = useMemo(
    () => ({
      ...baseFilters,
      search: debouncedSearch || undefined,
      category,
      fabric_type: fabricType,
      color: debouncedColor || undefined,
      max_price: priceNumber > 0 ? priceNumber : undefined,
      ...GSM_BANDS[gsm],
    }),
    [baseFilters, debouncedSearch, category, fabricType, debouncedColor, priceNumber, gsm]
  );

  const rolls = useRolls(filters);
  const data = useMemo(() => sortRolls(rolls.data ?? [], sort), [rolls.data, sort]);

  const activeCategory = categories.data?.find((c) => c.slug === category);
  const fabricTypes = activeCategory
    ? activeCategory.fabric_types
    : (categories.data ?? []).flatMap((c) => c.fabric_types);
  const activeFilterCount =
    (fabricType ? 1 : 0) + (gsm !== "all" ? 1 : 0) + (priceNumber > 0 ? 1 : 0) + (color.trim() ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  const resetFilters = () => {
    setFabricType(undefined);
    setGsm("all");
    setMaxPrice("");
    setColor("");
    setSort("newest");
  };

  const listHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {header}
      <Row style={{ paddingHorizontal: spacing.md }}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("catalog.searchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
            accessibilityLabel={t("catalog.searchPlaceholder")}
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("catalog.filters")}
          style={[styles.filterBtn, { backgroundColor: activeFilterCount ? colors.primary : colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="options-outline" size={22} color={activeFilterCount ? colors.primaryText : colors.text} />
          {activeFilterCount ? (
            <Text variant="caption" color={colors.primaryText} style={{ fontWeight: "800" }}>
              {activeFilterCount}
            </Text>
          ) : null}
        </Pressable>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
        <Chip label={t("catalog.allCategories")} selected={!category} onPress={() => { setCategory(undefined); setFabricType(undefined); }} />
        {(categories.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={category === c.slug} onPress={() => { setCategory(c.slug); setFabricType(undefined); }} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <>
      <FlatList
        data={rolls.isPending ? [] : data}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.md }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: "50%" }}>
            <RollCard roll={item} showStatus={showStatus} />
          </View>
        )}
        ListEmptyComponent={
          rolls.isPending ? (
            <CardSkeletonGrid />
          ) : rolls.isError ? (
            <ErrorState error={rolls.error} onRetry={() => void rolls.refetch()} />
          ) : (
            <EmptyState
              icon="layers-outline"
              title={emptyTitle ?? t("catalog.emptyTitle")}
              message={emptyMessage ?? t("catalog.emptyMessage")}
              actionLabel={activeFilterCount || search ? t("catalog.clearFilters") : undefined}
              onAction={() => {
                resetFilters();
                setSearch("");
              }}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={rolls.isRefetching} onRefresh={() => void rolls.refetch()} />}
        keyboardShouldPersistTaps="handled"
      />

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("catalog.filters")}
        footer={
          <Row style={{ gap: spacing.md }}>
            <Button title={t("catalog.reset")} variant="secondary" onPress={resetFilters} style={{ flex: 1 }} />
            <Button title={t("catalog.showResults")} onPress={() => setFiltersOpen(false)} style={{ flex: 1 }} />
          </Row>
        }
      >
        <View style={{ gap: spacing.sm }}>
          <Text variant="label">{t("catalog.sortBy")}</Text>
          <Row style={{ flexWrap: "wrap" }}>
            {(["newest", "price_asc", "price_desc", "yards_desc"] as SortKey[]).map((k) => (
              <Chip key={k} label={t(`catalog.sort.${k}`)} selected={sort === k} onPress={() => setSort(k)} />
            ))}
          </Row>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label">{t("catalog.weight")}</Text>
          <Row style={{ flexWrap: "wrap" }}>
            {(Object.keys(GSM_BANDS) as GsmBand[]).map((k) => (
              <Chip key={k} label={t(`catalog.gsm.${k}`)} selected={gsm === k} onPress={() => setGsm(k)} />
            ))}
          </Row>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label">{t("catalog.fabricType")}</Text>
          <Row style={{ flexWrap: "wrap" }}>
            <Chip label={t("catalog.any")} selected={!fabricType} onPress={() => setFabricType(undefined)} />
            {fabricTypes.map((ft) => (
              <Chip key={ft.id} label={ft.name} selected={fabricType === ft.slug} onPress={() => setFabricType(ft.slug)} />
            ))}
          </Row>
        </View>
        <TextField
          label={t("catalog.maxPrice")}
          value={maxPrice}
          onChangeText={setMaxPrice}
          keyboardType="decimal-pad"
          placeholder="500"
        />
        <TextField label={t("catalog.color")} value={color} onChangeText={setColor} placeholder={t("catalog.colorPlaceholder")} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: spacing.sm },
  filterBtn: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: spacing.sm,
  },
});
