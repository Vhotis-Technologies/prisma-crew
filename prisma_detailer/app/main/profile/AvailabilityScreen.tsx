import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAvailability } from "@/app/app-hooks/useAvailability";
import { AvailabilityCalendar } from "@/app/components/ui/profile/AvailabilityCalendar";
import { TimeSlotsSelector } from "@/app/components/ui/profile/TimeSlotsSelector";
import { AvailabilitySummary } from "@/app/components/ui/profile/AvailabilitySummary";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThemeContext } from "@/app/contexts/ThemeProvider";
import StyledText from "@/app/components/helpers/StyledText";
import {
  useGetAvailabilityQuery,
  useCreateAvailabilityMutation,
  useLazyGetBusyTimesQuery,
  useGetBusyTimesQuery,
} from "@/app/store/api/availabilityApi";
import { useAlertContext } from "@/app/contexts/AlertContext";

const AvailabilityScreen = () => {
  const backgroundColor = useThemeColor({}, "background");
  const primaryColor = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const { theme } = useThemeContext();
  const { setAlertConfig } = useAlertContext();

  const { data: availabilityData } = useGetAvailabilityQuery();
  const [createAvailability, { isLoading: isSaving }] = useCreateAvailabilityMutation();
  const [fetchBusyTimes, { isLoading: isBusyTimesLoading }] = useLazyGetBusyTimesQuery();

  const {
    selectedDates,
    currentMonth,
    currentYear,
    goToPreviousMonth,
    goToNextMonth,
    toggleTimeSlot,
    getMonthDays,
    clearAllSelections,
    getAllSelectedAvailabilities,
    selectOnlyDateWithBusySlots,
    setBusySlotsForDate,
  } = useAvailability(availabilityData ?? undefined);

  const [selectedDateForTimeSlots, setSelectedDateForTimeSlots] = useState<
    string | null
  >(null);
  const [pendingDateForSlots, setPendingDateForSlots] = useState<string | null>(null);

  const { data: busyTimesData } = useGetBusyTimesQuery(selectedDateForTimeSlots ?? null, {
    skip: !selectedDateForTimeSlots,
  });

  /* When the time-slot panel is open, refetch busy times for that date and merge so job blocks stay up to date. */
  useEffect(() => {
    if (busyTimesData && selectedDateForTimeSlots && busyTimesData.date === selectedDateForTimeSlots) {
      setBusySlotsForDate(selectedDateForTimeSlots, busyTimesData.busySlots);
    }
  }, [busyTimesData, selectedDateForTimeSlots, setBusySlotsForDate]);

  const handleDatePress = async (date: string) => {
    const currentSelected = selectedDates[0]?.date ?? null;
    if (currentSelected === date) {
      clearAllSelections();
      setSelectedDateForTimeSlots(null);
      return;
    }
    setPendingDateForSlots(date);
    try {
      const data = await fetchBusyTimes(date).unwrap();
      selectOnlyDateWithBusySlots(date, data.busySlots);
      setSelectedDateForTimeSlots(date);
    } catch {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Could not load job times for this date. Try again.",
        type: "error",
        onConfirm: () => {},
      });
    } finally {
      setPendingDateForSlots(null);
    }
  };

  const handleTimeSlotToggle = (timeSlotId: string) => {
    if (selectedDateForTimeSlots) {
      toggleTimeSlot(selectedDateForTimeSlots, timeSlotId);
    }
  };

  const getSelectedDateTimeSlots = () => {
    if (!selectedDateForTimeSlots) return [];
    const selectedDate = selectedDates.find(
      (d) => d.date === selectedDateForTimeSlots
    );
    return selectedDate?.timeSlots || [];
  };

  const selectedDatesStrings = selectedDates.map((date) => date.date);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: backgroundColor }]}
    >
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="calendar-outline" size={24} color={primaryColor} />
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            When I'm not available
          </StyledText>
        </View>
        <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8 }}>
          Select dates and times when you won't be available for work
        </StyledText>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Calendar Component */}
        <AvailabilityCalendar
          currentMonth={currentMonth}
          currentYear={currentYear}
          monthDays={getMonthDays()}
          selectedDates={selectedDatesStrings}
          onDatePress={handleDatePress}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />

        {/* Time Slots Selector - Only show when a date is selected; show loading while fetching busy times for a new date */}
        {pendingDateForSlots && isBusyTimesLoading ? (
          <View style={[styles.loadingSlotsContainer, { backgroundColor: primaryColor }]}>
            <ActivityIndicator size="small" color="#fff" />
            <StyledText variant="bodySmall" style={styles.loadingSlotsText}>
              Loading job times for this date…
            </StyledText>
          </View>
        ) : selectedDateForTimeSlots ? (
          <TimeSlotsSelector
            selectedDate={selectedDateForTimeSlots}
            timeSlots={getSelectedDateTimeSlots()}
            onTimeSlotToggle={handleTimeSlotToggle}
          />
        ) : null}

        {/* Availability Summary */}
        <AvailabilitySummary
          selectedDates={selectedDates}
          onClearAll={clearAllSelections}
          onSave={async () => {
            const payload = { selectedDates: getAllSelectedAvailabilities() };
            try {
              await createAvailability(payload).unwrap();
              setAlertConfig({
                isVisible: true,
                title: "Saved",
                message: "Your unavailability has been saved.",
                type: "success",
                onConfirm: () => {},
              });
            } catch (err: unknown) {
              const message =
                err && typeof err === "object" && "data" in err &&
                typeof (err as { data?: unknown }).data === "object" &&
                (err as { data?: { error?: string } }).data?.error
                  ? (err as { data: { error: string } }).data.error
                  : "Failed to save.";
              setAlertConfig({
                isVisible: true,
                title: "Error",
                message,
                type: "error",
                onConfirm: () => {},
              });
            }
          }}
          isSaving={isSaving}
        />

        {/* Instructions */}
        <View
          style={[
            styles.instructionsContainer,
            { backgroundColor: backgroundColor },
          ]}
        >
          <View style={styles.instructionsHeader}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={primaryColor}
            />
            <StyledText variant="titleMedium" style={{ color: textColor }}>
              How to use
            </StyledText>
          </View>
          <View style={styles.instructionsList}>
            <View style={styles.instructionItem}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={primaryColor}
              />
              <StyledText variant="bodySmall" style={{ color: textColor }}>
                Tap dates when you won't be available for work
              </StyledText>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={primaryColor}
              />
              <StyledText variant="bodySmall" style={{ color: textColor }}>
                Select time slots for each date you're off
              </StyledText>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={primaryColor}
              />
              <StyledText variant="bodySmall" style={{ color: textColor }}>
                Use quick selection (Morning/Afternoon/Evening) for faster setup
              </StyledText>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={primaryColor}
              />
              <StyledText variant="bodySmall" style={{ color: textColor }}>
                Slots marked "Booked" are existing jobs and cannot be changed
              </StyledText>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AvailabilityScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 5,
    paddingVertical: 5,
    paddingTop: 5,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  instructionsContainer: {
    borderRadius: 12,
    padding: 16,
    paddingBottom: 50,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingSlotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginHorizontal: 5,
    marginVertical: 5,
    borderRadius: 8,
    opacity: 0.9,
  },
  loadingSlotsText: {
    color: "#fff",
  },
  instructionText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
});
