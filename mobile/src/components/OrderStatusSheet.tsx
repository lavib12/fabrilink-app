import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform } from "react-native";

import { getErrorMessage } from "@/api/errors";
import type { Order, OrderStatus } from "@/api/types";
import { useUpdateOrderStatus } from "@/hooks/queries";
import { allowedNextStatuses } from "@/lib/orderStatus";
import { spacing } from "@/theme";

import { Button, Chip, Row, Sheet, Text, TextField } from "./ui";

/**
 * Lets hub staff/admins move an order to any *valid* next status, or a buyer cancel.
 * `only` restricts the choices (e.g. ["CANCELLED"] for buyers).
 */
export function OrderStatusSheet({
  order,
  visible,
  onClose,
  initialStatus,
  only,
}: {
  order: Order;
  visible: boolean;
  onClose: () => void;
  initialStatus?: OrderStatus;
  only?: OrderStatus[];
}) {
  const { t } = useTranslation();
  const update = useUpdateOrderStatus();
  const options = allowedNextStatuses(order.status).filter((s) => !only || only.includes(s));
  const [selected, setSelected] = useState<OrderStatus | undefined>(initialStatus ?? options[0]);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("Tejgaon Central Hub");

  useEffect(() => {
    if (visible) {
      setSelected(initialStatus ?? options[0]);
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialStatus, order.status]);

  const isCancel = selected === "CANCELLED";
  const isBuyerFlow = only?.length === 1 && only[0] === "CANCELLED";

  const submit = async () => {
    if (!selected) return;
    try {
      await update.mutateAsync({
        id: order.id,
        status: selected,
        notes: notes.trim() || undefined,
        location: isBuyerFlow ? undefined : location.trim() || undefined,
      });
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err) {
      Alert.alert(t("common.errorTitle"), getErrorMessage(err));
    }
  };

  const confirm = () => {
    if (!selected) return;
    Alert.alert(
      isCancel ? t("orderActions.cancelConfirmTitle") : t("orderActions.confirmTitle"),
      isCancel
        ? t("orderActions.cancelConfirmBody")
        : t("orderActions.confirmBody", { order: order.order_number, status: t(`orderStatus.${selected}`) }),
      [
        { text: t("common.back"), style: "cancel" },
        { text: t("common.confirm"), style: isCancel ? "destructive" : "default", onPress: () => void submit() },
      ]
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isBuyerFlow ? t("orderActions.cancelTitle") : t("orderActions.title")}
      footer={
        <Button
          title={selected ? t(isCancel ? "orderActions.cancelOrder" : "orderActions.moveTo", { status: t(`orderStatus.${selected}`) }) : t("common.confirm")}
          variant={isCancel ? "danger" : "primary"}
          onPress={confirm}
          loading={update.isPending}
          disabled={!selected}
        />
      }
    >
      {!isBuyerFlow ? (
        <>
          <Text muted>
            {t("orderActions.current")}: {t(`orderStatus.${order.status}`)}
          </Text>
          {options.length === 0 ? <Text>{t("orderActions.none")}</Text> : null}
          <Row style={{ flexWrap: "wrap", gap: spacing.sm }}>
            {options.map((s) => (
              <Chip key={s} label={t(`orderStatus.${s}`)} selected={selected === s} onPress={() => setSelected(s)} />
            ))}
          </Row>
          <TextField label={t("orderActions.location")} value={location} onChangeText={setLocation} />
        </>
      ) : (
        <Text muted>{t("orderActions.cancelExplain")}</Text>
      )}
      <TextField
        label={isCancel ? t("orderActions.cancelReason") : t("orderActions.notes")}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
    </Sheet>
  );
}
