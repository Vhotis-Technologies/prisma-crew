/**
 * Unavailable — lock new jobs for selected hours. Does not move assigned jobs.
 */
import { useMemo, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAvailability } from "@/app/app-hooks/useAvailability";
import { AvailabilityCalendar } from "@/app/components/ui/profile/AvailabilityCalendar";
import { TimeSlotsSelector } from "@/app/components/ui/profile/TimeSlotsSelector";
import { AvailabilitySummary } from "@/app/components/ui/profile/AvailabilitySummary";
import { Screen, CrewText, PrimaryButton } from "@/app/components/ui/system";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import {
  useGetAvailabilityQuery,
  useCreateAvailabilityMutation,
  useLazyGetBusyTimesQuery,
} from "@/app/store/api/availabilityApi";
import { useAlertContext } from "@/app/contexts/AlertContext";

export default function AvailabilityScreen() {
  const { colors, spacing, radius } = useThemeTokens();
  const { setAlertConfig } = useAlertContext();

  const { data: availabilityData, refetch } = useGetAvailabilityQuery();
  const [createAvailability, { isLoading: isSaving }] =
    useCreateAvailabilityMutation();
  const [fetchBusyTimes, { isLoading: isBusyTimesLoading }] =
    useLazyGetBusyTimesQuery();

  const {
    selectedDates,
    currentMonth,
    goToPreviousMonth,
    goToNextMonth,
    toggleTimeSlot,
    getMonthDays,
    clearAllSelections,
    clearSlotsForDate,
    getAllSelectedAvailabilities,
    openDateWithBusySlots,
    allowRehydrate,
  } = useAvailability(availabilityData ?? undefined);

  const [openDate, setOpenDate] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const unavailableDates = useMemo(
    () =>
      selectedDates
        .filter((date) =>
          date.timeSlots.some((slot) => slot.isSelected && !slot.isBlockedByJob),
        )
        .map((date) => date.date),
    [selectedDates],
  );

  const jobDates = useMemo(
    () =>
      selectedDates
        .filter((date) => date.timeSlots.some((slot) => slot.isBlockedByJob))
        .map((date) => date.date),
    [selectedDates],
  );

  const openSlots =
    selectedDates.find((date) => date.date === openDate)?.timeSlots || [];

  const handleDatePress = async (date: string) => {
    if (dayjs(date).isBefore(dayjs(), "day")) return;
    if (openDate === date) {
      setOpenDate(null);
      return;
    }
    setPendingDate(date);
    try {
      const data = await fetchBusyTimes(date).unwrap();
      openDateWithBusySlots(date, data.busySlots);
      setOpenDate(date);
    } catch {
      setAlertConfig({
        isVisible: true,
        title: "Could not load this date",
        message: "Try again in a moment.",
        type: "error",
        onConfirm: () => {},
      });
    } finally {
      setPendingDate(null);
    }
  };

  const persist = async (
    selectedDatesPayload: Array<{ date: string; timeSlots: string[] }>,
  ) => {
    try {
      await createAvailability({ selectedDates: selectedDatesPayload }).unwrap();
      allowRehydrate();
      await refetch();
      setAlertConfig({
        isVisible: true,
        title: "Saved",
        message:
          "You will not be given new jobs in these hours. Jobs already assigned to you are unchanged.",
        type: "success",
        onConfirm: () => {},
      });
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === "object" &&
        "data" in err &&
        typeof (err as { data?: { error?: string } }).data?.error === "string"
          ? (err as { data: { error: string } }).data.error
          : "Could not save unavailability.";
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message,
        type: "error",
        onConfirm: () => {},
      });
    }
  };

  const handleSave = async () => {
    const rows = getAllSelectedAvailabilities().filter(
      (row) => row.timeSlots.length > 0 || row.date === openDate,
    );
    if (rows.length === 0) {
      setAlertConfig({
        isVisible: true,
        title: "Nothing to save",
        message: "Tap a date and mark the hours you cannot work.",
        type: "warning",
        onConfirm: () => {},
      });
      return;
    }
    await persist(rows);
  };

  const handleRemoveAll = () => {
    setAlertConfig({
      isVisible: true,
      title: "Remove all unavailability?",
      message:
        "This lifts every upcoming lockout. Assigned jobs stay in your schedule.",
      type: "warning",
      onClose: () => {},
      onConfirm: async () => {
        clearAllSelections();
        setOpenDate(null);
        await persist([]);
      },
    });
  };

  return (
    <Screen
      padded={false}
      edges={["top"]}
      footer={
        <PrimaryButton
          label="Save"
          loading={isSaving}
          onPress={handleSave}
        />
      }
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.back,
              {
                borderColor: colors.borders,
                backgroundColor: colors.cards,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <CrewText variant="title">Unavailable</CrewText>
            <CrewText variant="caption" muted>
              Block hours so you are not given new jobs
            </CrewText>
          </View>
        </View>

        <View
          style={[
            styles.notice,
            {
              backgroundColor: colors.primarySoft,
              borderRadius: radius.md,
              padding: spacing.md,
            },
          ]}
        >
          <CrewText variant="body">
            This locks you out of new work only. Jobs already assigned to you
            stay put — ask support if one needs to be moved.
          </CrewText>
        </View>

        <AvailabilityCalendar
          currentMonth={currentMonth}
          monthDays={getMonthDays()}
          openDate={openDate}
          unavailableDates={unavailableDates}
          jobDates={jobDates}
          onDatePress={handleDatePress}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />

        {pendingDate && isBusyTimesLoading ? (
          <View
            style={[
              styles.loading,
              {
                backgroundColor: colors.cards,
                borderColor: colors.borders,
                borderRadius: radius.md,
              },
            ]}
          >
            <ActivityIndicator color={colors.button} />
            <CrewText variant="caption" muted>
              Checking assigned jobs…
            </CrewText>
          </View>
        ) : openDate ? (
          <TimeSlotsSelector
            selectedDate={openDate}
            timeSlots={openSlots}
            onTimeSlotToggle={(id) => toggleTimeSlot(openDate, id)}
          />
        ) : (
          <CrewText variant="body" muted>
            Tap a date to mark hours you cannot work.
          </CrewText>
        )}

        <AvailabilitySummary
          selectedDates={selectedDates}
          openDate={openDate}
          onClearOpenDate={() => openDate && clearSlotsForDate(openDate)}
          onRemoveAll={handleRemoveAll}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {},
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
    borderWidth: 1,
  },
});
