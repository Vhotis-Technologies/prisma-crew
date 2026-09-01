/**
 * Month grid. Monday-first. Equal 7-column weeks so dates sit under Mon–Sun.
 */
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "@/app/components/ui/system";

type AvailabilityCalendarProps = {
  currentMonth: dayjs.Dayjs;
  monthDays: dayjs.Dayjs[];
  openDate: string | null;
  unavailableDates?: string[];
  jobDates?: string[];
  onDatePress: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  lockPast?: boolean;
  canGoPrevious?: boolean;
  showLegend?: boolean;
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weeksOf(days: dayjs.Dayjs[]): dayjs.Dayjs[][] {
  const weeks: dayjs.Dayjs[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  currentMonth,
  monthDays,
  openDate,
  unavailableDates = [],
  jobDates = [],
  onDatePress,
  onPreviousMonth,
  onNextMonth,
  lockPast = true,
  canGoPrevious = true,
  showLegend = true,
}) => {
  const { colors, radius, spacing, tap } = useThemeTokens();
  const today = dayjs().startOf("day");
  const weeks = weeksOf(monthDays);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.cards,
          borderColor: colors.borders,
          borderRadius: radius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={onPreviousMonth}
          disabled={!canGoPrevious}
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoPrevious }}
          style={({ pressed }) => [
            styles.navButton,
            {
              backgroundColor: colors.primarySoft,
              borderRadius: radius.md,
              minWidth: tap.min,
              minHeight: tap.min,
              opacity: !canGoPrevious ? 0.35 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>

        <CrewText variant="subtitle">{currentMonth.format("MMMM YYYY")}</CrewText>

        <Pressable
          onPress={onNextMonth}
          accessibilityLabel="Next month"
          style={({ pressed }) => [
            styles.navButton,
            {
              backgroundColor: colors.primarySoft,
              borderRadius: radius.md,
              minWidth: tap.min,
              minHeight: tap.min,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEK_DAYS.map((day) => (
          <View key={day} style={styles.col}>
            <CrewText variant="caption" muted style={styles.centerText}>
              {day}
            </CrewText>
          </View>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week[0].format("YYYY-MM-DD")} style={styles.weekRow}>
          {week.map((date) => {
            const dateString = date.format("YYYY-MM-DD");
            const inMonth = date.month() === currentMonth.month();
            const isPast = date.isBefore(today, "day");
            const isToday = date.isSame(today, "day");
            const isOpen = openDate === dateString;
            const hasOff = unavailableDates.includes(dateString);
            const hasJob = jobDates.includes(dateString);
            const disabled = !inMonth || (lockPast && isPast);

            return (
              <Pressable
                key={dateString}
                disabled={disabled}
                onPress={() => onDatePress(dateString)}
                accessibilityLabel={date.format("D MMMM")}
                accessibilityState={{ disabled, selected: isOpen }}
                style={({ pressed }) => [
                  styles.col,
                  styles.dayCell,
                  {
                    minHeight: tap.min,
                    borderRadius: radius.sm,
                    backgroundColor: isOpen
                      ? colors.primary
                      : hasOff
                        ? colors.primarySoft
                        : "transparent",
                    borderWidth: isToday && !isOpen ? 1 : 0,
                    borderColor: colors.primary,
                    opacity: disabled ? 0.35 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <CrewText
                  variant="label"
                  color={
                    isOpen
                      ? colors.buttonText
                      : inMonth
                        ? colors.text
                        : colors.muted
                  }
                  style={styles.centerText}
                >
                  {date.format("D")}
                </CrewText>
                {hasJob && inMonth ? (
                  <View
                    style={[
                      styles.jobDot,
                      {
                        backgroundColor: isOpen
                          ? colors.buttonText
                          : colors.warning,
                      },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {showLegend ? (
        <View style={[styles.legend, { gap: spacing.md }]}>
          <LegendDot
            color={colors.primarySoft}
            border={colors.primary}
            label="Off"
          />
          <LegendDot color={colors.warning} label="Assigned job" />
        </View>
      ) : null}
    </View>
  );
};

function LegendDot({
  color,
  border,
  label,
}: {
  color: string;
  border?: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: color, borderColor: border ?? color },
        ]}
      />
      <CrewText variant="caption" muted>
        {label}
      </CrewText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  col: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCell: {
    paddingVertical: 5,
    margin:1,
  },
  centerText: {
    textAlign: "center",
    width: "100%",
  },
  jobDot: {
    position: "absolute",
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 5,
  },
  legend: {
    flexDirection: "row",
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
});
