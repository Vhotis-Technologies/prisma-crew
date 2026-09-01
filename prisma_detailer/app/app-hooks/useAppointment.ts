/**
 * Appointment hook: calendar navigation, daily time slots, job details, and appointment lifecycle actions.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { router } from "expo-router";
import {
  CalendarDayProps,
  TimeSlotProps,
} from "@/app/interfaces/AppointmentInterface";

dayjs.extend(isoWeek);
import {
  useGetAllAppointmentsQuery,
  useStartAppointmentMutation,
  useCompleteAppointmentMutation,
  useUploadBeforeImagesMutation,
  useUploadAfterImagesMutation,
  useSubmitFleetMaintenanceMutation,
} from "@/app/store/api/appointmentsApi";
import { useSnackbar } from "../contexts/SnackbarContext";

/**
 * Manages appointment calendar state, RTK Query data, and job actions.
 *
 * Features:
 * - Month/day navigation and calendar grid generation
 * - Daily time slots and appointment detail routing
 * - Start/complete, image upload, and fleet maintenance handlers
 *
 * @returns Calendar state, derived data, query results, and action handlers
 */
export const useAppointment = () => {
  const { showSnackbarWithConfig } = useSnackbar();

  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedDay, setSelectedDay] = useState<dayjs.Dayjs | null>(null);

  /* Destructure all the query apis here */
  const {
    data: allAppointments,
    isLoading: isLoadingAllAppointments,
    error: errorAllAppointments,
    isSuccess: isSuccessAllAppointments,
    isError: isErrorAllAppointments,
    refetch: refetchAllAppointments,
  } = useGetAllAppointmentsQuery(
    { date: selectedDay ? selectedDay.format("YYYY-MM-DD") : "" },
    { skip: !selectedDay, refetchOnFocus: true, refetchOnReconnect: true }
  );

  const [startAppointment, { isLoading: isLoadingStartAppointment }] =
    useStartAppointmentMutation();

  const [completeAppointment, { isLoading: isLoadingCompleteAppointment }] =
    useCompleteAppointmentMutation();

  const [uploadBeforeImages, { isLoading: isLoadingUploadBeforeImages }] =
    useUploadBeforeImagesMutation();

  const [uploadAfterImages, { isLoading: isLoadingUploadAfterImages }] =
    useUploadAfterImagesMutation();

  /**
   * Open job details by id. The details screen fetches a fresh payload so
   * status is never a stale cache from a previous job.
   */
  const handleJobPress = useCallback((id: string) => {
    router.push({
      pathname: "/main/appointments/AppointmentDetailsScreen",
      params: { id },
    });
  }, []);

  /**
   * Generate array of months for the scrollable month selector
   *
   * Creates an array of all 12 months for the current year with proper formatting
   * and selection states. Each month object contains display name, dayjs value,
   * and visual state indicators.
   *
   * @returns Array of month objects with name, value, and state indicators
   */
  const months = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 12 }, (_, index) => {
      const month = dayjs().year(currentYear).month(index);
      return {
        name: month.format("MMM"),
        value: month,
        isCurrent: month.isSame(dayjs(), "month"),
        isSelected: month.isSame(selectedMonth, "month"),
      };
    });
  }, [selectedMonth]);

  /**
   * Generate calendar days for the selected month
   *
   * Creates a complete calendar grid for the selected month, including:
   * - Days from the previous month to fill the first week
   * - All days of the current month
   * - Days from the next month to complete the last week
   * - Proper state indicators (today, selected, has appointments)
   *
   * @returns Array of CalendarDayProps for the month view
   */
  const calendarDays = useMemo(() => {
    const startOfMonth = selectedMonth.startOf("month");
    const endOfMonth = selectedMonth.endOf("month");
    const startOfWeek = startOfMonth.startOf("isoWeek");
    const endOfWeek = endOfMonth.endOf("isoWeek");

    const days: CalendarDayProps[] = [];
    let currentDay = startOfWeek;

    while (
      currentDay.isBefore(endOfWeek) ||
      currentDay.isSame(endOfWeek, "day")
    ) {
      const isCurrentMonth = currentDay.isSame(selectedMonth, "month");
      const isToday = currentDay.isSame(dayjs(), "day");
      const isSelected = selectedDay
        ? currentDay.isSame(selectedDay, "day")
        : false;

      days.push({
        date: currentDay.format("YYYY-MM-DD"),
        day: currentDay.date(),
        month: currentDay.month(),
        year: currentDay.year(),
        hasAppointments: false, // TODO: Fetch from API
        appointmentCount: 0, // TODO: Fetch from API
        isToday,
        isSelected,
      });

      currentDay = currentDay.add(1, "day");
    }

    return days;
  }, [selectedMonth, selectedDay]);

  /**
   * Generate time slots for the selected day (00:00 - 23:00)
   *
   * Creates 24 time slots for the selected day, one for each hour.
   * Each slot contains time information and placeholder for job data.
   * This is used in the daily view to show hourly availability.
   *
   * @returns Array of TimeSlotProps for the daily view
   */
  const timeSlots = useMemo(() => {
    if (!selectedDay) return [];

    const slots: TimeSlotProps[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const time = dayjs().hour(hour).minute(0).second(0);
      const timeString = time.format("HH:mm");

      slots.push({
        id: `${selectedDay.format("YYYY-MM-DD")}-${timeString}`,
        time: timeString,
        hour,
        hasJob: false, // TODO: Fetch from API
        job: undefined, // TODO: Fetch from API
      });
    }

    return slots;
  }, [selectedDay]);

  /**
   * Switch the calendar to a specific month and clear the selected day.
   * @param month - Target month as a dayjs instance
   */
  const navigateToMonth = (month: dayjs.Dayjs) => {
    setSelectedMonth(month);
    const today = dayjs();
    setSelectedDay(month.isSame(today, "month") ? today : month.startOf("month"));
  };

  /**
   * Select a specific day and navigate to daily screen
   *
   * Sets the selected day and navigates to the daily view screen
   * with the selected date as a route parameter. This is the main
   * interaction point for viewing daily appointments.
   *
   * @param day - dayjs object representing the selected day
   */
  const selectDay = useCallback(async (day: dayjs.Dayjs) => {
    setSelectedDay(day);
  }, []);

  /**
   * Navigate to previous month
   *
   * Moves the calendar view to the previous month and resets
   * the selected day. Used for month navigation controls.
   */
  const goToPreviousMonth = () => {
    const next = selectedMonth.subtract(1, "month");
    const today = dayjs();
    if (next.isBefore(today, "month")) return;
    setSelectedMonth(next);
    setSelectedDay(next.isSame(today, "month") ? today : next.startOf("month"));
  };

  /**
   * Navigate to next month
   *
   * Moves the calendar view to the next month and keeps a selected day
   * so assigned jobs further ahead stay loadable.
   */
  const goToNextMonth = () => {
    const next = selectedMonth.add(1, "month");
    setSelectedMonth(next);
    const today = dayjs();
    setSelectedDay(next.isSame(today, "month") ? today : next.startOf("month"));
  };

  /**
   * Navigate to current month
   *
   * Resets the calendar view to the current month and resets
   * the selected day. Used for "today" or "current month" buttons.
   */
  const goToCurrentMonth = () => {
    const today = dayjs();
    setSelectedMonth(today);
    setSelectedDay(today);
  };

  /**
   * Start the appointment
   * @param id - The id of the appointment
   * @returns {message: string} The message from the server
   */
  const handleStartAppointment = useCallback(
    async (id: string) => {
      try {
        const response = await startAppointment({ id }).unwrap();
        if (response && response.message) {
          showSnackbarWithConfig({
            message: response.message,
            type: "success",
            duration: 3000,
          });
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message ||
          error?.data?.error ||
          error?.message ||
          "Failed to start appointment";
        showSnackbarWithConfig({
          message: errorMessage,
          type: "error",
          duration: 3000,
        });
      }
    },
    [startAppointment, showSnackbarWithConfig]
  );

  /**
   * Complete the appointment
   * @param id - The id of the appointment
   * @returns {message: string} The message from the server
   */
  const handleCompleteAppointment = useCallback(
    async (id: string) => {
      try {
        const response = await completeAppointment({ id }).unwrap();
        if (response && response.message) {
          showSnackbarWithConfig({
            message: response.message,
            type: "success",
            duration: 3000,
          });
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message ||
          error?.data?.error ||
          error?.message ||
          "Failed to complete appointment";
        showSnackbarWithConfig({
          message: errorMessage,
          type: "error",
          duration: 3000,
        });
      }
    },
    [completeAppointment, showSnackbarWithConfig]
  );

  /**
   * Upload before images for an appointment
   * @param formData - FormData containing job_id and images
   * @returns {message: string, images: Array} Response with uploaded image details
   */
  const handleUploadBeforeImages = useCallback(
    async (formData: FormData) => {
      try {
        const response = await uploadBeforeImages(formData).unwrap();
        if (response && response.message) {
          showSnackbarWithConfig({
            message: response.message,
            type: "success",
            duration: 3000,
          });
        }
        return response;
      } catch (error: any) {
        const errorMessage =
          error?.data?.message ||
          error?.data?.error ||
          error?.message ||
          "Failed to upload before images";
        showSnackbarWithConfig({
          message: errorMessage,
          type: "error",
          duration: 3000,
        });
        throw error;
      }
    },
    [uploadBeforeImages, showSnackbarWithConfig]
  );

  /**
   * Upload after images for an appointment
   * @param formData - FormData containing job_id and images
   * @returns {message: string, images: Array} Response with uploaded image details
   */
  const handleUploadAfterImages = useCallback(
    async (formData: FormData) => {
      try {
        const response = await uploadAfterImages(formData).unwrap();
        if (response && response.message) {
          showSnackbarWithConfig({
            message: response.message,
            type: "success",
            duration: 3000,
          });
        }
        return response;
      } catch (error: any) {
        const errorMessage =
          error?.data?.message ||
          error?.data?.error ||
          error?.message ||
          "Failed to upload after images";
        showSnackbarWithConfig({
          message: errorMessage,
          type: "error",
          duration: 3000,
        });
        throw error;
      }
    },
    [uploadAfterImages, showSnackbarWithConfig]
  );

  const [
    submitFleetMaintenance,
    { isLoading: isLoadingSubmitFleetMaintenance },
  ] = useSubmitFleetMaintenanceMutation();

  /**
   * Submit fleet maintenance data for an appointment
   * @param jobId - The job ID
   * @param fleetMaintenanceData - Fleet maintenance data object
   * @returns {message: string, fleet_maintenance: object} Response with fleet maintenance data
   */
  const handleSubmitFleetMaintenance = useCallback(
    async (jobId: string, fleetMaintenanceData: any) => {
      try {
        const response = await submitFleetMaintenance({
          job_id: jobId,
          ...fleetMaintenanceData,
        }).unwrap();
        if (response && response.message) {
          showSnackbarWithConfig({
            message: response.message,
            type: "success",
            duration: 3000,
          });
        }
        return response;
      } catch (error: any) {
        const errorMessage =
          error?.data?.message ||
          error?.data?.error ||
          error?.message ||
          "Failed to submit fleet maintenance data";
        showSnackbarWithConfig({
          message: errorMessage,
          type: "error",
          duration: 3000,
        });
        throw error;
      }
    },
    [submitFleetMaintenance, showSnackbarWithConfig]
  );

  return {
    // State
    selectedMonth,
    selectedDay,
    allAppointments,
    isLoadingAllAppointments,

    // Data
    months,
    calendarDays,
    timeSlots,

    // Actions
    navigateToMonth,
    selectDay,
    setSelectedDay,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    handleJobPress,
    handleStartAppointment,
    handleCompleteAppointment,
    handleUploadBeforeImages,
    handleUploadAfterImages,
    handleSubmitFleetMaintenance,
    isLoadingUploadBeforeImages,
    isLoadingUploadAfterImages,
    isLoadingSubmitFleetMaintenance,
    refetchAllAppointments,
  };
};
