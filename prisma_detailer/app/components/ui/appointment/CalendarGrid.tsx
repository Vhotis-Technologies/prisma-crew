import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from "react-native";
import dayjs from "dayjs";
import { CalendarDayProps } from "../../../../interfaces/AppointmentInterface";

/**
 * CalendarGrid Component
 *
 * Displays a calendar grid with days of the month, including weekday headers
 * and proper visual states for today, selected day, and other month days.
 *
 * Props:
 * - calendarDays: Array of calendar day objects
 * - selectedMonth: Currently selected month
 * - onDaySelect: Callback function when a day is selected
 * - dayItemHeight: Calculated height for day items
 */
interface CalendarGridProps {
  calendarDays: CalendarDayProps[];
  selectedMonth: dayjs.Dayjs;
  onDaySelect: (day: dayjs.Dayjs) => void;
  dayItemHeight: number;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  calendarDays,
  selectedMonth,
  onDaySelect,
  dayItemHeight,
}) => {
  const screenWidth = Dimensions.get("window").width;

  /**
   * Render weekday headers (Sun, Mon, Tue, etc.)
   */
  const renderWeekdayHeader = () => {
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <View style={styles.weekdayHeader}>
        {weekdays.map((day, index) => (
          <View
            key={index}
            style={[styles.weekdayItem, { width: (screenWidth - 32) / 7 }]}
          >
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Render individual day in the calendar grid
   */
  const renderDayItem = ({ item }: { item: CalendarDayProps }) => {
    const isCurrentMonth = dayjs(item.date).isSame(selectedMonth, "month");

    return (
      <TouchableOpacity
        style={[
          styles.dayItem,
          {
            height: dayItemHeight,
            width: (screenWidth - 32) / 7,
          },
          !isCurrentMonth && styles.otherMonthDay,
          item.isToday && styles.todayItem,
          item.isSelected && styles.selectedDayItem,
        ]}
        onPress={() => onDaySelect(dayjs(item.date))}
        disabled={!isCurrentMonth}
      >
        <Text
          style={[
            styles.dayText,
            !isCurrentMonth && styles.otherMonthDayText,
            item.isToday && styles.todayText,
            item.isSelected && styles.selectedDayText,
          ]}
        >
          {item.day}
        </Text>
        {item.hasAppointments && (
          <View style={styles.appointmentIndicator}>
            <Text style={styles.appointmentCount}>{item.appointmentCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderWeekdayHeader()}
      <FlatList
        data={calendarDays}
        renderItem={renderDayItem}
        keyExtractor={(item) => item.date}
        numColumns={7}
        scrollEnabled={false}
        contentContainerStyle={styles.calendarGrid}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weekdayHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },
  weekdayItem: {
    alignItems: "center",
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  calendarGrid: {
    flexGrow: 1,
  },
  dayItem: {
    alignItems: "center",
    justifyContent: "center",
    margin: 1,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    position: "relative",
  },
  otherMonthDay: {
    backgroundColor: "#f0f0f0",
  },
  todayItem: {
    backgroundColor: "#e3f2fd",
    borderWidth: 2,
    borderColor: "#2196f3",
  },
  selectedDayItem: {
    backgroundColor: "#007AFF",
  },
  dayText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  otherMonthDayText: {
    color: "#ccc",
  },
  todayText: {
    color: "#2196f3",
    fontWeight: "bold",
  },
  selectedDayText: {
    color: "#fff",
    fontWeight: "bold",
  },
  appointmentIndicator: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ff4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  appointmentCount: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "bold",
  },
});

export default CalendarGrid;
