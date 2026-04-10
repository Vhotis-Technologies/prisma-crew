import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";

interface AvailabilityCalendarProps {
  currentMonth: dayjs.Dayjs;
  currentYear: number;
  monthDays: dayjs.Dayjs[];
  selectedDates: string[];
  onDatePress: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

const CELL_GAP = 4;
const DAYS_PER_WEEK = 7;
const CONTAINER_PADDING_H = 16 * 2; // horizontal padding of container

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  currentMonth,
  currentYear,
  monthDays,
  selectedDates,
  onDatePress,
  onPreviousMonth,
  onNextMonth,
}) => {
  const [contentWidth, setContentWidth] = useState(0);

  const cardColor = useThemeColor({}, "cards");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");
  const textColor = useThemeColor({}, "text");
  const buttonTextColor = useThemeColor({}, "buttonText");
  const iconColor = useThemeColor({}, "icons");

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setContentWidth(Math.max(0, width - CONTAINER_PADDING_H));
  };

  const cellSize =
    contentWidth > 0
      ? (contentWidth - (DAYS_PER_WEEK - 1) * CELL_GAP) / DAYS_PER_WEEK
      : 0;

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const isDateSelected = (date: dayjs.Dayjs) => {
    return selectedDates.includes(date.format("YYYY-MM-DD"));
  };

  const isCurrentMonth = (date: dayjs.Dayjs) => {
    return date.month() === currentMonth.month();
  };

  const isToday = (date: dayjs.Dayjs) => {
    return date.isSame(dayjs(), "day");
  };

  return (
    <View
      style={[styles.container, { backgroundColor: cardColor, borderColor }]}
      onLayout={onLayout}
    >
      {/* Header with month navigation */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: primaryColor }]}
          onPress={onPreviousMonth}
        >
          <Ionicons name="chevron-back" size={20} color={buttonTextColor} />
        </TouchableOpacity>

        <StyledText variant="titleMedium" style={{ color: textColor }}>
          {currentMonth.format("MMMM YYYY")}
        </StyledText>

        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: primaryColor }]}
          onPress={onNextMonth}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={buttonTextColor}
          />
        </TouchableOpacity>
      </View>

      {/* Week days header - same width as date grid so each day sits directly above its column */}
      <View
        style={[
          styles.weekDaysContainer,
          cellSize > 0 && { width: contentWidth },
        ]}
      >
        {weekDays.map((day, index) => (
          <View
            key={index}
            style={[
              styles.weekDayHeader,
              cellSize > 0 && {
                width: cellSize,
                marginRight: index < 6 ? CELL_GAP : 0,
              },
            ]}
          >
            <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8 }}>
              {day}
            </StyledText>
          </View>
        ))}
      </View>

      {/* Calendar grid - same width as week days row */}
      <ScrollView
        style={styles.calendarContainer}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.calendarGrid,
            cellSize > 0 && { width: contentWidth },
          ]}
        >
          {monthDays.map((date, index) => {
            const dateString = date.format("YYYY-MM-DD");
            const selected = isDateSelected(date);
            const currentMonthDate = isCurrentMonth(date);
            const today = isToday(date);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateCell,
                  cellSize > 0 && {
                    width: cellSize,
                    height: cellSize,
                    marginRight: (index % 7) < 6 ? CELL_GAP : 0,
                    marginBottom: CELL_GAP,
                  },
                  {
                    backgroundColor: selected ? primaryColor : "transparent",
                    borderColor: today ? primaryColor : borderColor,
                    borderWidth: today ? 1 : 0,
                    opacity: currentMonthDate ? 1 : 0.3,
                  },
                ]}
                onPress={() => onDatePress(dateString)}
                disabled={!currentMonthDate}
              >
                <StyledText
                  style={[
                    styles.dateText,
                    {
                      color: selected
                        ? buttonTextColor
                        : currentMonthDate
                        ? textColor
                        : iconColor,
                      fontWeight: today ? "bold" : "normal",
                      opacity: currentMonthDate ? 1 : 0.5,
                    },
                  ]}
                >
                  {date.format("D")}
                </StyledText>
                {selected && currentMonthDate && (
                  <View
                    style={[
                      styles.selectedIndicator,
                      { backgroundColor: buttonTextColor },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 5,
    marginVertical: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navButton: {
    width: 30,
    height: 30,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: "600",
  },
  weekDaysContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayHeader: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  calendarContainer: {
    flexGrow: 1,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dateCell: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    position: "relative",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
  },
  selectedIndicator: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
