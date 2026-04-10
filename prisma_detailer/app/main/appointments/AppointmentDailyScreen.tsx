import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import React, { useMemo, useEffect, useRef, useState } from "react";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import { useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import {
  TimeSlotProps,
  JobDetailsProps,
  ServiceTypeProps,
  JobCardProps,
} from "../../interfaces/AppointmentInterface";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import TimeSlot from "@/app/components/ui/appointment/TimeSlot";
import { Ionicons } from "@expo/vector-icons";

/**
 * AppointmentDailyScreen Component
 *
 * This component displays a detailed daily view of appointments for a selected date.
 * It shows all 24 hours (00:00-23:00) with job cards for scheduled appointments
 * and empty slots for available times.
 *
 * Features:
 * - 24-hour time slot display
 * - Job cards with client and service information
 * - Status indicators with color coding
 * - Current time highlighting
 * - Past time slot dimming
 * - Real appointment data from API
 *
 * Navigation:
 * - Receives date parameter from calendar screen
 * - Displays comprehensive job information
 * - Ready for job details navigation (future enhancement)
 */

const AppointmentDailyScreen = () => {
  const {
    allAppointments,
    isLoadingAllAppointments,
    setSelectedDay,
    refetchAllAppointments,
  } = useAppointment();
  const params = useLocalSearchParams();
  const hasSetSelectedDay = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* Import the colors */
  const backgroundColor = useThemeColor({}, "background");
  const iconsColor = useThemeColor({}, "icons");
  // Get the date from route params
  const selectedDate = params.date ? dayjs(params.date as string) : null;

  // Set the selected day in the hook when the screen loads (only once)
  useEffect(() => {
    if (selectedDate && !hasSetSelectedDay.current) {
      setSelectedDay(selectedDate);
      hasSetSelectedDay.current = true;
    }
  }, [selectedDate]); // Remove setSelectedDay from dependencies to prevent infinite loop

  // The appointments will be fetched automatically by the query when the date changes

  /**
   * Handle pull-to-refresh functionality
   *
   * Triggers a refetch of appointment data when user pulls down on the list.
   * Uses the refetchAllAppointments function from the useAppointment hook.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchAllAppointments();
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Generate time slots with real API data
   *
   * Creates 24 time slots for the selected date, populating them with
   * real job data from the API where available. Each slot represents one hour
   * from 00:00 to 23:00. Jobs that span multiple hours will occupy
   * multiple consecutive slots.
   *
   * @returns Array of TimeSlotProps with job data where applicable
   */
  const timeSlotsWithData = useMemo(() => {
    if (!selectedDate) return [];

    const slots: TimeSlotProps[] = [];
    const occupiedSlots = new Set<number>();
    // allAppointments

    // If no appointments, return empty slots
    if (!allAppointments || allAppointments.length === 0) {
      for (let hour = 0; hour < 24; hour++) {
        const time = dayjs().hour(hour).minute(0).second(0);
        const timeString = time.format("HH:mm");

        slots.push({
          id: `${selectedDate.format("YYYY-MM-DD")}-${timeString}`,
          time: timeString,
          hour,
          hasJob: false,
          job: undefined,
        });
      }
      return slots;
    }

    for (let hour = 0; hour < 24; hour++) {
      const time = dayjs().hour(hour).minute(0).second(0);
      const timeString = time.format("HH:mm");

      // Skip if this slot is occupied by a previous job
      if (occupiedSlots.has(hour)) {
        slots.push({
          id: `${selectedDate.format("YYYY-MM-DD")}-${timeString}`,
          time: timeString,
          hour,
          hasJob: false,
          isOccupiedByPreviousJob: true,
          job: undefined,
        });
        continue;
      }

      // Find appointment for this hour
      const appointment =
        allAppointments && allAppointments.length > 0
          ? allAppointments.find((appointment: JobCardProps) => {
              // Parse the time string directly to get the hour
              const [hours, minutes] = appointment.appointment_time
                .split(":")
                .map(Number);
              const appointmentHour = hours;
              // Log
              //   `Checking hour ${hour} against appointment time ${appointment.appointment_time} (hour: ${appointmentHour})`
              // );
              return appointmentHour === hour;
            })
          : undefined;

      if (appointment) {
        // appointment found for this hour
        // Creating slot with hasJob: true
        // Calculate how many slots this job should occupy
        const slotsToOccupy = Math.ceil(appointment.duration / 60);

        // Mark subsequent slots as occupied
        for (let i = 1; i < slotsToOccupy; i++) {
          if (hour + i < 24) {
            occupiedSlots.add(hour + i);
          }
        }

        slots.push({
          id: `${selectedDate.format("YYYY-MM-DD")}-${timeString}`,
          time: timeString,
          hour,
          hasJob: true,
          job: appointment,
          slotsToOccupy: slotsToOccupy,
        });
      } else {
        slots.push({
          id: `${selectedDate.format("YYYY-MM-DD")}-${timeString}`,
          time: timeString,
          hour,
          hasJob: false,
          job: undefined,
        });
      }
    }

    return slots;
  }, [selectedDate, allAppointments]);

  /**
   * Render individual time slot
   *
   * Renders a single time slot using the TimeSlot component.
   *
   * @param item - TimeSlotProps object containing time and job data
   * @returns TimeSlot component
   */
  const renderTimeSlot = ({ item }: { item: TimeSlotProps }) => {
    const hasAppointmentsForDay = allAppointments && allAppointments.length > 0;
    return (
      <TimeSlot
        item={item}
        selectedDate={selectedDate!}
        hasAppointmentsForDay={hasAppointmentsForDay}
      />
    );
  };

  /**
   * Render header with selected date and refresh button
   *
   * Displays the selected date in a readable format, shows
   * the total number of appointments for that day, and includes
   * a manual refresh button for convenience.
   *
   * @returns View component with date header, appointment count, and refresh button
   */
  const renderHeader = () => (
    <View style={[styles.headerContainer, { backgroundColor }]}>
      <View style={styles.headerContent}>
        <View style={styles.headerTextContainer}>
          <StyledText variant="titleMedium">
            {selectedDate
              ? selectedDate.format("dddd, MMMM D, YYYY")
              : "Select a day"}
          </StyledText>
          <StyledText variant="bodyMedium">
            {selectedDate && allAppointments && allAppointments.length > 0
              ? `${allAppointments.length} appointments`
              : "No appointments for this date"}
          </StyledText>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          style={[styles.refreshButton, { backgroundColor: iconsColor + "20" }]}
          disabled={isRefreshing}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={iconsColor}
            style={isRefreshing ? styles.refreshingIcon : undefined}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!selectedDate) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor }]}>
        <StyledText variant="bodyMedium">
          Please select a day from the calendar to view appointments
        </StyledText>
      </View>
    );
  }

  if (isLoadingAllAppointments) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={iconsColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {renderHeader()}
      <FlatList
        data={timeSlotsWithData}
        renderItem={renderTimeSlot}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.timeSlotsList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[iconsColor]} // Android
            tintColor={iconsColor} // iOS
          />
        }
      />
    </View>
  );
};

export default AppointmentDailyScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Header Styles
  headerContainer: {
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  refreshingIcon: {
    opacity: 0.6,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },

  // Time Slots List
  timeSlotsList: {
    padding: 16,
  },
});
