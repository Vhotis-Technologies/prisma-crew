import React from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useThemeColor } from "@/hooks/useThemeColor";
import { AvailabilityDate } from "../../../app-hooks/useAvailability";
import StyledText from "@/app/components/helpers/StyledText";

export interface AvailabilitySummaryProps {
  selectedDates: AvailabilityDate[];
  onClearAll: () => void;
  onSave?: () => void | Promise<void>;
  isSaving?: boolean;
}

export const AvailabilitySummary: React.FC<AvailabilitySummaryProps> = (props) => {
  const {
    selectedDates,
    onClearAll,
    onSave,
    isSaving = false,
  } = props;
  const cardColor = useThemeColor({}, "cards");
  const primaryColor = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const buttonTextColor = useThemeColor({}, "buttonText");
  const iconColor = useThemeColor({}, "icons");
  const errorColor = useThemeColor({}, "error");

  const totalSelectedSlots = selectedDates.reduce((total, date) => {
    return total + date.timeSlots.filter((slot) => slot.isSelected).length;
  }, 0);

  const formatDate = (dateString: string) => {
    return dayjs(dateString).format("MMM D, YYYY");
  };

  const formatTimeSlots = (
    timeSlots: { time: string; isSelected: boolean }[]
  ) => {
    const selectedSlots = timeSlots
      .filter((slot) => slot.isSelected)
      .map((slot) => slot.time);
    if (selectedSlots.length === 0) return "No times marked unavailable";
    if (selectedSlots.length <= 3) return selectedSlots.join(", ");
    return `${selectedSlots.slice(0, 3).join(", ")} +${
      selectedSlots.length - 3
    } more`;
  };

  if (selectedDates.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={iconColor} />
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            No unavailability set
          </StyledText>
          <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8 }}>
            Select dates and times above when you won't be available for work
          </StyledText>
        </View>
        {onSave && (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: borderColor }]}
            onPress={onSave}
            disabled
          >
            <Ionicons name="save-outline" size={18} color={textColor} />
            <StyledText variant="bodySmall" style={[styles.saveButtonText, { color: textColor }]}>
              Save
            </StyledText>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="checkmark-circle" size={20} color={primaryColor} />
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            When I'm not available
          </StyledText>
        </View>
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: errorColor }]}
          onPress={onClearAll}
        >
          <Ionicons name="trash-outline" size={16} color={buttonTextColor} />
          <StyledText variant="bodySmall" style={{ color: buttonTextColor }}>
            Clear All
          </StyledText>
        </TouchableOpacity>
      </View>

      {/* Summary stats */}
      <View style={[styles.summaryStats, { backgroundColor: primaryColor + "18" }]}>
        <View style={styles.statItem}>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            {selectedDates.length}
          </StyledText>
          <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8 }}>
            Date{selectedDates.length !== 1 ? "s" : ""}
          </StyledText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
        <View style={styles.statItem}>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            {totalSelectedSlots}
          </StyledText>
          <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8 }}>
            Time Slot{totalSelectedSlots !== 1 ? "s" : ""}
          </StyledText>
        </View>
      </View>

      {/* Selected dates list */}
      <ScrollView style={styles.datesList} showsVerticalScrollIndicator={false}>
        {selectedDates.map((date) => (
          <View key={date.date} style={[styles.dateItem, { borderBottomColor: borderColor }]}>
            <View style={styles.dateHeader}>
              <Ionicons name="calendar" size={16} color={primaryColor} />
              <StyledText variant="bodySmall" style={{ color: textColor }}>
                {formatDate(date.date)}
              </StyledText>
            </View>
            <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8 }}>
              {formatTimeSlots(date.timeSlots)}
            </StyledText>
          </View>
        ))}
      </ScrollView>

      {/* Save button */}
      {onSave && (
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: primaryColor }]}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={buttonTextColor} />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color={buttonTextColor} />
              <StyledText variant="bodySmall" style={[styles.saveButtonText, { color: buttonTextColor }]}>
                Save
              </StyledText>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 5,
    marginVertical: 5,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  datesList: {
    maxHeight: 200,
  },
  dateItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  saveButtonText: {},
  dateText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  timeSlotsText: {
    fontSize: 12,
    marginLeft: 24,
  },
});
