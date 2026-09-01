/**
 * Compact history card — date, time, service. Opens job details on press.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import type { JobStatus } from "@/app/interfaces/AppointmentInterface";
import { StatusTone } from "@/constants/theme";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "@/app/components/ui/system";

type HistoryCardProps = {
  date: string;
  time: string;
  serviceName: string;
  status: JobStatus;
  onPress: () => void;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  accepted: "Assigned",
  in_progress: "In progress",
  completed: "Done",
  cancelled: "Cancelled",
};

export function HistoryCard({
  date,
  time,
  serviceName,
  status,
  onPress,
}: HistoryCardProps) {
  const { colors, radius, spacing } = useThemeTokens();
  const when = dayjs(`${date} ${time}`);
  const label = when.isValid()
    ? when.format("ddd D MMM · HH:mm")
    : `${date} · ${time}`;
  const toneKey = StatusTone[status];
  const chipFg =
    toneKey === "primary"
      ? colors.primary
      : toneKey === "success"
        ? colors.success
        : toneKey === "error"
          ? colors.error
          : colors.warning;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${serviceName}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.cards,
          borderColor: colors.borders,
          borderRadius: radius.md,
          padding: spacing.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.body}>
        <CrewText variant="caption" muted>
          {label}
        </CrewText>
        <CrewText variant="subtitle" numberOfLines={1}>
          {serviceName}
        </CrewText>
        <CrewText variant="caption" color={chipFg}>
          {STATUS_LABEL[status]}
        </CrewText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    gap: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
