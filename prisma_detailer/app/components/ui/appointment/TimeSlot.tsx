import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import React from "react";
import dayjs from "dayjs";
import { router } from "expo-router";
import {
  TimeSlotProps,
  JobCardProps,
} from "../../../interfaces/AppointmentInterface";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../../helpers/StyledText";
import JobCard from "./JobCard";
import LinearGradientComponent from "../../helpers/LinearGradientComponent";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import { useAlertContext } from "@/app/contexts/AlertContext";

/**
 * TimeSlot Component
 *
 * This component renders a single time slot with either a job card (if appointment exists)
 * or an empty slot (if no appointment). Handles visual states for current time and past times.
 * When a job card is pressed, it navigates to the appointment details screen.
 *
 * Features:
 * - Time label display with current/past time highlighting
 * - Job card with client and service information
 * - Status indicators with color coding
 * - Navigation to details screen on press
 * - Empty slot display for available times
 *
 * @param item - TimeSlotProps object containing time and job data
 * @param selectedDate - The selected date for context
 * @returns View component for the time slot
 */

interface TimeSlotComponentProps {
  item: TimeSlotProps;
  selectedDate: dayjs.Dayjs;
  hasAppointmentsForDay?: boolean;
}

const TimeSlot: React.FC<TimeSlotComponentProps> = ({
  item,
  selectedDate,
  hasAppointmentsForDay = true,
}) => {
  const { handleJobPress } = useAppointment();

  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");

  const isCurrentHour =
    dayjs().hour() === item.hour && dayjs().isSame(selectedDate, "day");
  const isPastHour = dayjs().isAfter(dayjs(selectedDate).hour(item.hour));



  // If this slot is occupied by a previous job, render an empty slot with appropriate height
  if (item.isOccupiedByPreviousJob) {
    return (
      <View style={[styles.timeSlotContainer, { marginBottom: 0 }]}>
        <View style={styles.timeLabelContainer}>
          <StyledText
            style={[
              isCurrentHour && styles.currentTimeLabel,
              isPastHour && styles.pastTimeLabel,
            ]}
            variant="bodySmall"
          >
            {item.time}
          </StyledText>
        </View>
        <View style={styles.jobCardContainer}>
          <View style={styles.occupiedSlot} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.timeSlotContainer}>
      {/* Time Label */}
      <View style={styles.timeLabelContainer}>
        <StyledText
          style={[
            isCurrentHour && styles.currentTimeLabel,
            isPastHour && styles.pastTimeLabel,
          ]}
          variant="bodySmall"
        >
          {item.time}
        </StyledText>
      </View>

      {/* Job Card or Empty Slot */}
      <View style={styles.jobCardContainer}>
        {item.hasJob && item.job ? (
          <JobCard
            job={item.job}
            onPress={() => handleJobPress(item?.job?.id?.toString() || "")}
            slotsToOccupy={item.slotsToOccupy}
          />
        ) : (
          <LinearGradientComponent
            color1={cardColor}
            color2={textColor}
            start={{ x: 0, y: 0 }}
            end={{ x: 2, y: 3 }}
            style={[styles.emptySlot]}
          >
            <StyledText
              variant="bodyMedium"
              style={[
                styles.emptySlotText,
                { color: textColor },
                isPastHour && styles.pastEmptySlotText,
              ]}
            >
              {hasAppointmentsForDay ? "Available" : "Available for Booking"}
            </StyledText>
          </LinearGradientComponent>
        )}
      </View>
    </View>
  );
};

export default TimeSlot;

const styles = StyleSheet.create({
  // Time Slot Container
  timeSlotContainer: {
    flexDirection: "row",
    marginBottom: 8, // Reduced margin to accommodate multi-slot jobs
  },

  // Time Label
  timeLabelContainer: {
    width: 40,
    paddingTop: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  currentTimeLabel: {
    color: "#007AFF",
    fontWeight: "bold",
  },
  pastTimeLabel: {
    color: "#999",
  },
  jobCardContainer: {
    flex: 1,
    marginLeft: 12,
  },
  emptySlot: {
    borderRadius: 3,
    padding: 10,
  },
  pastEmptySlot: {
    opacity: 0.6,
  },
  emptySlotText: {
    fontSize: 14,
    textAlign: "center",
  },
  pastEmptySlotText: {
    color: "#999",
  },
  occupiedSlot: {
    height: 60, // Height for occupied slot
    backgroundColor: "transparent", // Transparent since the job card above covers this area
  },
});
