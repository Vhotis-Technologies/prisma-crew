/**
 * Hour chips for one day. Assigned jobs are locked; the rest is lockout.
 */
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import dayjs from "dayjs";
import { TimeSlot } from "../../../app-hooks/useAvailability";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText, PrimaryButton } from "@/app/components/ui/system";

type TimeSlotsSelectorProps = {
  selectedDate: string;
  timeSlots: TimeSlot[];
  onTimeSlotToggle: (timeSlotId: string) => void;
};

export const TimeSlotsSelector: React.FC<TimeSlotsSelectorProps> = ({
  selectedDate,
  timeSlots,
  onTimeSlotToggle,
}) => {
  const { colors, radius, spacing, tap } = useThemeTokens();
  const offCount = timeSlots.filter(
    (slot) => slot.isSelected && !slot.isBlockedByJob,
  ).length;

  const selectRange = (from: number, to: number) => {
    timeSlots.forEach((slot) => {
      const hour = parseInt(slot.time.split(":")[0], 10);
      if (
        hour >= from &&
        hour < to &&
        !slot.isSelected &&
        !slot.isBlockedByJob
      ) {
        onTimeSlotToggle(slot.id);
      }
    });
  };

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
      <CrewText variant="subtitle">
        {dayjs(selectedDate).format("dddd D MMMM")}
      </CrewText>
      <CrewText variant="caption" muted>
        Tap hours you cannot work. Assigned jobs stay and cannot be moved here.
      </CrewText>
      <CrewText variant="label">
        {offCount} hour{offCount === 1 ? "" : "s"} locked for new jobs
      </CrewText>

      <View style={styles.grid}>
        {timeSlots.map((slot) => {
          const blocked = Boolean(slot.isBlockedByJob);
          const on = slot.isSelected && !blocked;
          return (
            <Pressable
              key={slot.id}
              onPress={() => !blocked && onTimeSlotToggle(slot.id)}
              disabled={blocked}
              accessibilityLabel={
                blocked ? `${slot.time} assigned job` : slot.time
              }
              style={({ pressed }) => [
                styles.slot,
                {
                  minHeight: tap.min,
                  borderRadius: radius.md,
                  backgroundColor: blocked
                    ? colors.warningBg
                    : on
                      ? colors.primary
                      : colors.canvas,
                  borderColor: blocked
                    ? colors.warning
                    : on
                      ? colors.primary
                      : colors.borders,
                  opacity: pressed && !blocked ? 0.85 : 1,
                },
              ]}
            >
              <CrewText
                variant="label"
                color={on ? colors.buttonText : colors.text}
              >
                {slot.time}
              </CrewText>
              {blocked ? (
                <CrewText variant="caption" color={colors.warning}>
                  Assigned
                </CrewText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        <PrimaryButton
          label="Morning"
          variant="secondary"
          fullWidth={false}
          onPress={() => selectRange(6, 12)}
        />
        <PrimaryButton
          label="Afternoon"
          variant="secondary"
          fullWidth={false}
          onPress={() => selectRange(12, 18)}
        />
        <PrimaryButton
          label="Evening"
          variant="secondary"
          fullWidth={false}
          onPress={() => selectRange(18, 21)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slot: {
    width: "31%",
    flexGrow: 1,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
});
