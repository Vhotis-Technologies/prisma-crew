/**
 * List of upcoming lockout days. Save lives in the screen footer.
 */
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import dayjs from "dayjs";
import { AvailabilityDate } from "../../../app-hooks/useAvailability";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "@/app/components/ui/system";

export type AvailabilitySummaryProps = {
  selectedDates: AvailabilityDate[];
  openDate: string | null;
  onClearOpenDate: () => void;
  onRemoveAll: () => void;
};

function offHours(date: AvailabilityDate) {
  return date.timeSlots.filter((slot) => slot.isSelected && !slot.isBlockedByJob);
}

export const AvailabilitySummary: React.FC<AvailabilitySummaryProps> = ({
  selectedDates,
  openDate,
  onClearOpenDate,
  onRemoveAll,
}) => {
  const { colors, radius, spacing } = useThemeTokens();
  const upcoming = selectedDates
    .map((date) => ({ date, hours: offHours(date) }))
    .filter((row) => row.hours.length > 0);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.cards,
          borderColor: colors.borders,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <CrewText variant="subtitle">Upcoming unavailability</CrewText>

      {upcoming.length === 0 ? (
        <CrewText variant="body" muted>
          No hours blocked yet. Tap a date, then the hours you cannot work.
        </CrewText>
      ) : (
        upcoming.map(({ date, hours }) => (
          <View key={date.date} style={{ gap: 2 }}>
            <CrewText variant="label">
              {dayjs(date.date).format("ddd D MMM")}
            </CrewText>
            <CrewText variant="caption" muted>
              {hours.length <= 4
                ? hours.map((slot) => slot.time).join(", ")
                : `${hours
                    .slice(0, 3)
                    .map((slot) => slot.time)
                    .join(", ")} +${hours.length - 3} more`}
            </CrewText>
          </View>
        ))
      )}

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
        {openDate ? (
          <Pressable onPress={onClearOpenDate} hitSlop={8}>
            <CrewText variant="label" color={colors.primary}>
              Clear this day
            </CrewText>
          </Pressable>
        ) : null}
        {upcoming.length > 0 ? (
          <Pressable onPress={onRemoveAll} hitSlop={8}>
            <CrewText variant="label" color={colors.error}>
              Remove all
            </CrewText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
});
