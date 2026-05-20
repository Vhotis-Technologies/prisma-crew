/**
 * Appointment hook: calendar navigation, daily time slots, job details, and appointment lifecycle actions.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import dayjs from "dayjs";
import { router, useRouter } from "expo-router";
import {
  CalendarDayProps,
  TimeSlotProps,
} from "@/app/interfaces/AppointmentInterface";
import {
  useGetAllAppointmentsQuery,
  useGetAppointmentDetailsQuery,
  useStartAppointmentMutation,
  useCompleteAppointmentMutation,
  useUploadBeforeImagesMutation,
  useUploadAfterImagesMutation,
  useSubmitFleetMaintenanceMutation,
} from "@/app/store/api/appointmentsApi";
import { useAlertContext } from "../contexts/AlertContext";
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
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);

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

  const {
    data: appointmentDetails,
    isLoading: isLoadingAppointmentDetails,
    error: errorAppointmentDetails,
    refetch: refetchAppointmentDetails,
  } = useGetAppointmentDetailsQuery(
    { id: selectedAppointmentId },
    {
      skip: !selectedAppointmentId,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  /**
   * Route to the appointment details screen when the appointment details are loaded
   * FIXED: Reset selectedAppointmentId after navigation to prevent stuck state
   */
  useEffect(() => {
    if (
      !isLoadingAppointmentDetails &&
      appointmentDetails &&
      selectedAppointmentId
    ) {
      // Navigate to details screen
      router.push({
        pathname: "/main/appointments/AppointmentDetailsScreen",
        params: { appointmentDetails: JSON.stringify(appointmentDetails) },
      });
      setSelectedAppointmentId(null);
    }
  }, [isLoadingAppointmentDetails, appointmentDetails, selectedAppointmentId]);

  /**
   * FIXED: Handle errors in appointment details fetching
   */
  useEffect(() => {
    if (errorAppointmentDetails && selectedAppointmentId) {
      console.error(
        "Error fetching appointment details:",
        errorAppointmentDetails
      );
      setAlertConfig({
        title: "Error",
        message: "Failed to load appointment details. Please try again.",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
          setSelectedAppointmentId(null); // Reset state on error
        },
      });
    }
  }, [
    errorAppointmentDetails,
    selectedAppointmentId,
    setAlertConfig,
    setIsVisible,
  ]);

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
    const startOfWeek = startOfMonth.startOf("week");
    const endOfWeek = endOfMonth.endOf("week");

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
    setSelectedDay(null); // Reset selected day when changing months
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
    const date = day.format("YYYY-MM-DD");
    router.push({
      pathname: "/main/appointments/AppointmentDailyScreen",
      params: { date: day.format("YYYY-MM-DD") },
    });
  }, []);

  /**
   * Navigate to previous month
   *
   * Moves the calendar view to the previous month and resets
   * the selected day. Used for month navigation controls.
   */
  const goToPreviousMonth = () => {
    setSelectedMonth(selectedMonth.subtract(1, "month"));
    setSelectedDay(null);
  };

  /**
   * Navigate to next month
   *
   * Moves the calendar view to the next month and resets
   * the selected day. Used for month navigation controls.
   */
  const goToNextMonth = () => {
    setSelectedMonth(selectedMonth.add(1, "month"));
    setSelectedDay(null);
  };

  /**
   * Handle job card press by loading appointment details.
   * @param id - Appointment/job ID
   */
  const handleJobPress = useCallback(
    async (id: string) => {
      try {
        // Reset any previous state
        setSelectedAppointmentId(null);

        // Small delay to ensure state is reset before setting new ID
        setTimeout(() => {
          setSelectedAppointmentId(id);
        }, 50);
      } catch (error) {
        console.error("Error in handleJobPress:", error);
        setAlertConfig({
          title: "Error",
          message: "Failed to load appointment. Please try again.",
          type: "error",
          isVisible: true,
          onConfirm: () => setIsVisible(false),
        });
      }
    },
    [setAlertConfig, setIsVisible]
  );

  /**
   * Navigate to current month
   *
   * Resets the calendar view to the current month and resets
   * the selected day. Used for "today" or "current month" buttons.
   */
  const goToCurrentMonth = () => {
    setSelectedMonth(dayjs());
    setSelectedDay(null);
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
    selectedAppointmentId,
    appointmentDetails,
    isLoadingAppointmentDetails,
    errorAppointmentDetails, // Add error state to return

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
    refetchAppointmentDetails,
  };
};
