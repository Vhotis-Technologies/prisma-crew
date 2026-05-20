/**
 * Dashboard hook: today's overview, quick stats, recent jobs, and quick actions.
 */
import { useState, useEffect, useCallback } from "react";
import {
  QuickStatsProps,
  QuickActionProps,
  RecentJobProps,
  TodayOverviewProps,
} from "../interfaces/DashboardInterface";
import { router } from "expo-router";
import {
  useGetQuickStatsQuery,
  useGetRecentJobsQuery,
  useGetTodayOverviewQuery,
} from "../store/api/dashboardApi";
import { useAlertContext } from "../contexts/AlertContext";
import * as Linking from "expo-linking";
import { useNotification } from "./useNotification";
import { useNotificationService } from "./useNotificationService";
import { usePermissions } from "./usePermissions";
import * as SecureStore from "expo-secure-store";
import {
  getPushTokenFromStorage,
  isPushTokenSavedToServer,
} from "../utils/storage";

/**
 * Fetches dashboard data via RTK Query and exposes navigation/action handlers.
 * @returns Dashboard metrics, loading flags, quick actions, and refetch helpers
 */
export const useDashboard = () => {
  /*
   * RTK Query Hooks
   * These hooks handle API calls with automatic caching, background updates,
   * and loading states. They provide the primary data source for the dashboard.
   */

  // Quick stats data (earnings, job counts, ratings)
  const {
    data: quickStats,
    isLoading: isLoadingQuickStats,
    refetch: refetchQuickStats,
  } = useGetQuickStatsQuery();

  // Recent jobs data (completed jobs from last 7 days)
  const {
    data: recentJobs,
    isLoading: isLoadingRecentJobs,
    refetch: refetchRecentJobs,
  } = useGetRecentJobsQuery();

  // Today's overview data (appointments, current job, next appointment)
  const {
    data: todayOverview,
    isLoading: isLoadingTodayOverview,
    refetch: refetchTodayOverview,
  } = useGetTodayOverviewQuery();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const { refreshNotifications } = useNotification();

  // Get notification service and permissions
  const { expoPushToken, initializeNotificationService } =
    useNotificationService();
  const { requestNotificationPermission, permissionStatus } = usePermissions();

  /**
   * Request push permission and register token on first dashboard load when needed.
   */
  useEffect(() => {
    const initializeNotifications = async () => {
      // Check if we already have a stored push token that was saved to server
      const storedToken = await getPushTokenFromStorage();
      const tokenSavedToServer = await isPushTokenSavedToServer();

      if (storedToken && tokenSavedToServer) {
        return;
      }

      // Check if we've already requested permissions
      const hasRequestedPermissions = await SecureStore.getItemAsync(
        "notification_permission_requested"
      );

      if (!hasRequestedPermissions) {
        // Request notification permission
        const granted = await requestNotificationPermission();

        if (granted) {
          // Initialize notification service to get token
          await initializeNotificationService();

          // Mark that we've requested permissions
          await SecureStore.setItemAsync(
            "notification_permission_requested",
            "true"
          );
        }
      } else if (permissionStatus.notifications.granted && !expoPushToken) {
        // If permissions were granted before but we don't have a token, initialize
        await initializeNotificationService();
      }
    };

    initializeNotifications();
  }, []);

  /**
   * Quick Actions Configuration
   *
   * Defines the quick action buttons that appear on the dashboard.
   * Each action has an ID, title, icon, and callback function for navigation
   * or other interactions.
   */
  const handleQuickActions: QuickActionProps[] = [
    {
      id: "start-job",
      title: "Start Job",
      icon: "▶️",
      action: () => router.push("/main/appointments/AppointmentDailyScreen"),
    },
    {
      id: "view-calendar",
      title: "Calendar",
      icon: "📅",
      action: () => router.push("/main/appointments/AppointmentCalendarScreen"),
    },
    {
      id: "add-availability",
      title: "Availability",
      icon: "⏰",
      action: () => router.push("/main/profile/AvailabilityScreen"),
    },
    {
      id: "contact-support",
      title: "Support",
      icon: "📨",
      action: () => {
        const email = "support@prismavalet.com";
        const subject = "Support Request";

        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(
          subject
        )}`;

        Linking.openURL(mailtoUrl).catch((err) => {
          console.error("Failed to open email client:", err);
        });
      },
    },
  ];

  /**
   * Refetch all dashboard queries and notification list.
   */
  const refetchAllData = useCallback(async () => {
    refetchQuickStats();
    refetchRecentJobs();
    refetchTodayOverview();
    refreshNotifications();
  }, [
    refetchQuickStats,
    refetchRecentJobs,
    refetchTodayOverview,
    refreshNotifications,
  ]);

  /**
   * Refresh dashboard data after a booking update event.
   * @param data - Booking update payload from realtime/event source
   */
  const handleBookingUpdate = useCallback(
    (data: any) => {
      // Trigger dashboard refresh
      // Trigger dashboard refresh
      refetchAllData();
    },
    [refetchAllData]
  );
  /**
   * View Next Appointment Handler
   *
   * Handles the action when a user wants to view their next appointment.
   * Currently logs the action for debugging purposes.
   *
   * TODO: Implement actual appointment viewing functionality
   */
  const viewNextAppointment = useCallback(() => {
    // TODO: Implement view appointment functionality
    // TODO: Implement view appointment functionality
  }, []);

  /**
   * Open the device dialer for a client phone number after confirmation.
   * @param phoneNumber - Client phone number to call
   */
  const callClient = useCallback(
    (phoneNumber: string) => {
      if (!phoneNumber) {
        return;
      }

      setAlertConfig({
        isVisible: true,
        title: "Make a call",
        message: `Are you sure you want to call ${phoneNumber}?`,
        type: "success",
        onConfirm() {
          Linking.openURL(`tel:${phoneNumber}`);
          setIsVisible(false);
        },
        onClose() {
          setIsVisible(false);
        },
      });
    },
    [setAlertConfig, setIsVisible]
  );

  return {
    // Action handlers for user interactions
    viewNextAppointment,
    handleQuickActions,

    // Dashboard data with fallback values for consistent UI experience
    quickStats: quickStats || {
      weeklyEarnings: 0,
      monthlyEarnings: 0,
      completedJobsThisWeek: 0,
      completedJobsThisMonth: 0,
      pendingJobsCount: 0,
      averageRating: 0,
      totalReviews: 0,
    },
    recentJobs: recentJobs || [],

    // Loading states for conditional rendering
    isLoadingQuickStats,
    isLoadingRecentJobs,
    isLoadingTodayOverview,
    // Today's overview with fallback data
    todayOverview: todayOverview || {
      totalAppointments: 0,
      completedJobs: 0,
      pendingJobs: 0,
    },
    callClient,
    // Data refresh functionality
    refetchAllData,
  };
};
