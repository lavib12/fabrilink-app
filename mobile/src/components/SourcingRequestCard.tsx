import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { SourcingRequest } from "@/api/types";
import { formatDate, formatNumber } from "@/lib/format";
import { spacing } from "@/theme";

import { Badge, PressableCard, Row, Text, type Tone } from "./ui";

const TONE: Record<SourcingRequest["status"], Tone> = {
  OPEN: "success",
  FULFILLED: "primary",
  CLOSED: "neutral",
};

/** Specs as a natural sentence fragment rather than a dotted meta string. */
export function useRequestSpecs(r: SourcingRequest): string {
  const { t } = useTranslation();
  const parts = [
    r.target_gsm ? t("requests.specGsm", { gsm: r.target_gsm }) : null,
    r.required_yards ? t("requests.specYards", { yards: formatNumber(r.required_yards) }) : null,
    r.color_preference || null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : t("requests.noSpecs");
}

export function SourcingRequestCard({ request, showBuyer = false }: { request: SourcingRequest; showBuyer?: boolean }) {
  const { t } = useTranslation();
  const specs = useRequestSpecs(request);
  return (
    <PressableCard
      onPress={() => router.push({ pathname: "/requests/[id]", params: { id: request.id } })}
      accessibilityLabel={`${request.fabric_name}, ${t(`requests.status.${request.status}`)}`}
      style={{ gap: spacing.sm }}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text variant="label" style={{ flex: 1 }} numberOfLines={2}>
          {request.fabric_name}
        </Text>
        <Badge label={t(`requests.status.${request.status}`)} tone={TONE[request.status]} />
      </Row>
      {showBuyer ? <Text muted>{request.buyer_name}</Text> : null}
      <Text variant="caption" muted numeric>
        {specs}
      </Text>
      <View>
        <Text variant="caption" muted>
          {t("requests.posted", { date: formatDate(request.created_at) })}
        </Text>
      </View>
    </PressableCard>
  );
}
