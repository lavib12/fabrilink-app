import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";

import type { SourcingStatus } from "@/api/types";
import { SourcingRequestCard } from "@/components/SourcingRequestCard";
import { Button, Chip, EmptyState, ErrorState, ListSkeleton, Text } from "@/components/ui";
import { useSourcingRequests } from "@/hooks/queries";
import { needsKyc } from "@/lib/routing";
import { useAuth } from "@/store/auth";
import { spacing, useTheme } from "@/theme";

/**
 * One screen, three audiences:
 *   buyer   — their own requests, and a button to post a new one
 *   factory — the open-request board (what boutiques are looking for)
 *   admin   — every request
 */
export default function SourcingRequestsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const isBuyer = user?.role === "BUYER";
  const isFactory = user?.role === "FACTORY";
  const [status, setStatus] = useState<SourcingStatus | undefined>(isFactory ? "OPEN" : undefined);
  const requests = useSourcingRequests(status);

  if (!user) return <Redirect href="/login" />;

  const filters: (SourcingStatus | undefined)[] = isFactory ? ["OPEN"] : [undefined, "OPEN", "FULFILLED", "CLOSED"];

  return (
    <>
      <Stack.Screen options={{ title: isFactory ? t("requests.boardTitle") : t("requests.title") }} />
      <FlatList
        data={requests.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <Text muted>{isFactory ? t("requests.boardIntro") : isBuyer ? t("requests.buyerIntro") : t("requests.adminIntro")}</Text>
            {isBuyer ? (
              <Button
                title={t("requests.new")}
                icon={<Ionicons name="add" size={20} color={colors.primaryText} />}
                onPress={() => router.push(needsKyc(user) ? "/pending-approval" : "/requests/new")}
              />
            ) : null}
            {filters.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {filters.map((f) => (
                  <Chip
                    key={f ?? "ALL"}
                    label={f ? t(`requests.status.${f}`) : t("orders.all")}
                    selected={status === f}
                    onPress={() => setStatus(f)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <SourcingRequestCard request={item} showBuyer={!isBuyer} />}
        ListEmptyComponent={
          requests.isPending ? (
            <ListSkeleton rows={3} />
          ) : requests.isError ? (
            <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
          ) : (
            <EmptyState
              icon="search-outline"
              title={isFactory ? t("requests.emptyBoard") : t("requests.emptyTitle")}
              message={isBuyer ? t("requests.emptyMessage") : undefined}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={requests.isRefetching} onRefresh={() => void requests.refetch()} />}
      />
    </>
  );
}
