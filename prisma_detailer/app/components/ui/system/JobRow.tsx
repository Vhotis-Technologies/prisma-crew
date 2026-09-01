/**
 * JobRow — today/schedule list row. No prices.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { JobStatus } from "@/app/interfaces/AppointmentInterface";
import { StatusTone } from "@/constants/theme";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "./CrewText";

type JobRowProps = {
  time: string;
  serviceName: string;
  clientName: string;
  status: JobStatus;
  durationMin?: number;
  location?: string;
  isCurrent?: boolean;
  onPress?: () => void;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  accepted: "Assigned",
  in_progress: "In progress",
  completed: "Done",
  cancelled: "Cancelled",
};

export function JobRow({
  time,
  serviceName,
  clientName,
  status,
  durationMin,
  location,
  isCurrent = false,
  onPress,
}: JobRowProps) {
  const { colors, radius, spacing } = useThemeTokens();
  const toneKey = StatusTone[status];
  const chipFg =
    toneKey === "primary"
      ? colors.primary
      : toneKey === "success"
        ? colors.success
        : toneKey === "error"
          ? colors.error
          : colors.warning;
  const chipBg =
    toneKey === "primary"
      ? colors.primarySoft
      : toneKey === "success"
        ? colors.successBg
        : toneKey === "error"
          ? colors.errorBg
          : colors.warningBg;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "summary"}
      accessibilityLabel={`${time}, ${serviceName}, ${clientName}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.cards,
          borderColor: isCurrent ? colors.primary : colors.borders,
          borderWidth: isCurrent ? 2 : 1,
          borderRadius: radius.md,
          padding: spacing.md,
          opacity: pressed && onPress ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.timeCol}>
        <CrewText variant="subtitle">{time}</CrewText>
        {durationMin ? (
          <CrewText variant="caption" muted>
            {durationMin} min
          </CrewText>
        ) : null}
      </View>
      <View style={styles.body}>
        <CrewText variant="subtitle" numberOfLines={1}>
          {serviceName}
        </CrewText>
        <CrewText variant="body" muted numberOfLines={1}>
          {clientName}
          {location ? ` · ${location}` : ""}
        </CrewText>
      </View>
      <View
        style={[
          styles.chip,
          {
            backgroundColor: chipBg,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xxs,
          },
        ]}
      >
        <CrewText variant="caption" color={chipFg}>
          {STATUS_LABEL[status]}
        </CrewText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeCol: {
    width: 64,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  chip: {
    flexShrink: 0,
  },
});
