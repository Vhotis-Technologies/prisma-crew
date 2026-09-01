/**
 * Schedule — month calendar of today and upcoming assigned jobs. No prices.
 */
import { useEffect, useMemo } from "react";
import { View, RefreshControl, ScrollView } from "react-native";
import dayjs from "dayjs";
import { router } from "expo-router";
import { Screen, JobRow, CrewText, EmptyState, PrimaryButton } from "@/app/components/ui/system";
import { AvailabilityCalendar } from "@/app/components/ui/profile/AvailabilityCalendar";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import type { JobCardProps } from "@/app/interfaces/AppointmentInterface";
import { CrewRoutes } from "../crewRoutes";

export default function ScheduleScreen() {
  const { colors, spacing } = useThemeTokens();
  const {
    selectedDay,
    selectedMonth,
    setSelectedDay,
    allAppointments,
    isLoadingAllAppointments,
    handleJobPress,
    refetchAllAppointments,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    calendarDays,
  } = useAppointment();

  useEffect(() => {
    const today = dayjs();
    if (!selectedDay || selectedDay.isBefore(today, "day")) {
      setSelectedDay(today);
    }
  }, [selectedDay, setSelectedDay]);

  const active = selectedDay ?? dayjs();
  const monthDays = useMemo(
    () => calendarDays.map((day) => dayjs(day.date)),
    [calendarDays],
  );

  const jobs: JobCardProps[] = Array.isArray(allAppointments)
    ? [...allAppointments].sort((a, b) =>
        a.appointment_time.localeCompare(b.appointment_time),
      )
    : [];

  const canGoPrevious = selectedMonth.isAfter(dayjs(), "month");
  const showJumpToToday = !active.isSame(dayjs(), "day");

  return (
    <Screen padded={false} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(isLoadingAllAppointments)}
            onRefresh={refetchAllAppointments}
            tintColor={colors.button}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <CrewText variant="title">Schedule</CrewText>
        <CrewText variant="body" muted>
          Today and upcoming assigned jobs. Past work is in Job history.
        </CrewText>

        <AvailabilityCalendar
          currentMonth={selectedMonth}
          monthDays={monthDays}
          openDate={active.format("YYYY-MM-DD")}
          onDatePress={(date) => {
            const day = dayjs(date);
            if (day.isBefore(dayjs(), "day")) return;
            setSelectedDay(day);
          }}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          lockPast
          canGoPrevious={canGoPrevious}
          showLegend={false}
        />

        {showJumpToToday ? (
          <PrimaryButton
            label="Jump to today"
            variant="ghost"
            onPress={goToCurrentMonth}
          />
        ) : null}

        <CrewText variant="label" muted>
          {active.format("dddd D MMMM")}
        </CrewText>

        {jobs.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No jobs on this day"
            body="Assigned work for this date will appear here."
          />
        ) : (
          <View style={{ gap: spacing.xs }}>
            {jobs.map((job) => (
              <JobRow
                key={String(job.id)}
                time={job.appointment_time}
                serviceName={job.service_type}
                clientName={job.client_name}
                status={job.status}
                durationMin={job.duration}
                location={job.address}
                isCurrent={job.status === "in_progress"}
                onPress={() => handleJobPress(String(job.id))}
              />
            ))}
          </View>
        )}

        <PrimaryButton
          label="Job history"
          variant="ghost"
          onPress={() => router.push(CrewRoutes.history)}
        />
      </ScrollView>
    </Screen>
  );
}