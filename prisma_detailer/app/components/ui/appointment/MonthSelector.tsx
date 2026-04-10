import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import dayjs from "dayjs";

/**
 * MonthSelector Component
 *
 * A horizontal scrollable month selector that displays all 12 months
 * with visual indicators for current and selected months.
 *
 * Props:
 * - months: Array of month objects with name, value, and state indicators
 * - onMonthSelect: Callback function when a month is selected
 * - selectedMonth: Currently selected month
 */
interface MonthSelectorProps {
  months: Array<{
    name: string;
    value: dayjs.Dayjs;
    isCurrent: boolean;
    isSelected: boolean;
  }>;
  onMonthSelect: (month: dayjs.Dayjs) => void;
  selectedMonth: dayjs.Dayjs;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({
  months,
  onMonthSelect,
  selectedMonth,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Month</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {months.map((month, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.monthItem,
              month.isSelected && styles.selectedMonthItem,
              month.isCurrent && styles.currentMonthItem,
            ]}
            onPress={() => onMonthSelect(month.value)}
          >
            <Text
              style={[
                styles.monthText,
                month.isSelected && styles.selectedMonthText,
                month.isCurrent && styles.currentMonthText,
              ]}
            >
              {month.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  scrollContainer: {
    paddingHorizontal: 8,
  },
  monthItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    minWidth: 60,
    alignItems: "center",
  },
  selectedMonthItem: {
    backgroundColor: "#007AFF",
  },
  currentMonthItem: {
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  monthText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  selectedMonthText: {
    color: "#fff",
  },
  currentMonthText: {
    color: "#007AFF",
  },
});

export default MonthSelector;
