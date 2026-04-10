import React from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useThemeColor } from "@/hooks/useThemeColor";
import { TimeSlot } from "../../../app-hooks/useAvailability";
import StyledText from "@/app/components/helpers/StyledText";

interface TimeSlotsSelectorProps {
  selectedDate: string;
  timeSlots: TimeSlot[];
  onTimeSlotToggle: (timeSlotId: string) => void;
}

const { width } = Dimensions.get("window");

export const TimeSlotsSelector: React.FC<TimeSlotsSelectorProps> = ({
  selectedDate,
  timeSlots,
  onTimeSlotToggle,
}) => {
  const cardColor = useThemeColor({}, "cards");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const buttonTextColor = useThemeColor({}, "buttonText");

  const formatDate = (dateString: string) => {
    return dayjs(dateString).format("dddd, MMMM D, YYYY");
  };

  const selectedSlots = timeSlots.filter(
    (slot) => slot.isSelected && !slot.isBlockedByJob
  );

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="time-outline" size={20} color={primaryColor} />
        <StyledText variant="titleMedium" style={{ color: textColor, marginLeft: 8 }}>
          Unavailable times for {formatDate(selectedDate)}
        </StyledText>
      </View>

      {/* Selected count */}
      <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8, marginBottom: 12 }}>
        {selectedSlots.length} time slot{selectedSlots.length !== 1 ? "s" : ""}{" "}
        marked unavailable
      </StyledText>

      {/* Time slots grid */}
      <ScrollView
        style={styles.timeSlotsContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        <View style={styles.timeSlotsGrid}>
          {timeSlots.map((slot) => {
            const blocked = slot.isBlockedByJob;
            return (
              <TouchableOpacity
                key={slot.id}
                style={[
                  styles.timeSlot,
                  {
                    backgroundColor: blocked
                      ? borderColor
                      : slot.isSelected
                        ? primaryColor
                        : backgroundColor,
                    borderColor: blocked
                      ? borderColor
                      : slot.isSelected
                        ? primaryColor
                        : borderColor,
                    opacity: blocked ? 0.7 : 1,
                  },
                ]}
                onPress={() => !blocked && onTimeSlotToggle(slot.id)}
                disabled={blocked}
              >
                <StyledText
                  style={[
                    styles.timeText,
                    {
                      color: blocked
                        ? textColor
                        : slot.isSelected
                          ? buttonTextColor
                          : textColor,
                      fontWeight: slot.isSelected ? "600" : "500",
                    },
                  ]}
                >
                  {slot.time}
                </StyledText>
                {blocked ? (
                  <StyledText
                    variant="bodySmall"
                    style={[styles.bookedLabel, { color: textColor }]}
                  >
                    Booked
                  </StyledText>
                ) : (
                  slot.isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={buttonTextColor}
                      style={styles.checkIcon}
                    />
                  )
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Quick selection buttons */}
      <View style={styles.quickSelectionContainer}>
        <TouchableOpacity
          style={[styles.quickButton, { backgroundColor: primaryColor }]}
          onPress={() => {
            timeSlots.forEach((slot) => {
              const hour = parseInt(slot.time.split(":")[0]);
              if (
                hour >= 6 &&
                hour < 12 &&
                !slot.isSelected &&
                !slot.isBlockedByJob
              ) {
                onTimeSlotToggle(slot.id);
              }
            });
          }}
        >
          <StyledText variant="bodySmall" style={{ color: buttonTextColor }}>
            Morning
          </StyledText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickButton, { backgroundColor: primaryColor }]}
          onPress={() => {
            timeSlots.forEach((slot) => {
              const hour = parseInt(slot.time.split(":")[0]);
              if (
                hour >= 12 &&
                hour < 18 &&
                !slot.isSelected &&
                !slot.isBlockedByJob
              ) {
                onTimeSlotToggle(slot.id);
              }
            });
          }}
        >
          <StyledText variant="bodySmall" style={{ color: buttonTextColor }}>
            Afternoon
          </StyledText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickButton, { backgroundColor: primaryColor }]}
          onPress={() => {
            timeSlots.forEach((slot) => {
              const hour = parseInt(slot.time.split(":")[0]);
              if (
                hour >= 18 &&
                hour <= 20 &&
                !slot.isSelected &&
                !slot.isBlockedByJob
              ) {
                onTimeSlotToggle(slot.id);
              }
            });
          }}
        >
          <StyledText variant="bodySmall" style={{ color: buttonTextColor }}>
            Evening
          </StyledText>
        </TouchableOpacity>
      </View>
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
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  selectedCount: {
    fontSize: 14,
    marginBottom: 16,
  },
  timeSlotsContainer: {
    maxHeight: 200,
  },
  timeSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  timeSlot: {
    width: (width - 80) / 3,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  timeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  checkIcon: {
    position: "absolute",
    top: 2,
    right: 2,
  },
  bookedLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  quickSelectionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  quickButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
