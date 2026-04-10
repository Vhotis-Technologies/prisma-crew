/**
 * Dashboard Hook - useDashboard
 *
 * This custom hook manages all dashboard-related data and interactions for the detailer application.
 * It provides a centralized way to access dashboard data, handle user interactions, and manage
 * the state of various dashboard components.
 *
 * The hook integrates with RTK Query for API calls and provides fallback data to ensure
 * the UI always has data to display, even when API calls are loading or fail.
 *
 * Key Features:
 * - Fetches today's overview, quick stats, and recent jobs data
 * - Provides fallback data for consistent UI experience
 * - Handles dashboard interactions (view appointments, start jobs, etc.)
 * - Manages quick actions for navigation
 * - Provides data refetching capabilities
 *
 * @author Detailer App Team
 * @version 1.0.0
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
 * Custom hook for managing dashboard data and state
 *
 * This hook serves as the main data layer for the dashboard screen, providing:
 * - Real-time data from the API
 * - Fallback data for consistent UI experience
 * - Action handlers for user interactions
 * - Data refetching capabilities
 *
 * The hook uses RTK Query for efficient API calls with caching and automatic
 * background updates. It also provides mock data structures for development
 * and fallback scenarios.
 *
 * @returns {Object} Dashboard data and action handlers
 * @returns {Function} viewNextAppointment - Handler for viewing next appointment
 * @returns {Function} startCurrentJob - Handler for starting/continuing current job
 * @returns {QuickActionProps[]} handleQuickActions - Array of quick action buttons
 * @returns {QuickStatsProps} quickStats - Quick statistics data with fallbacks
 * @returns {RecentJobProps[]} recentJobs - Recent jobs data with fallbacks
 * @returns {boolean} isLoadingQuickStats - Loading state for quick stats
 * @returns {boolean} isLoadingRecentJobs - Loading state for recent jobs
 * @returns {boolean} isLoadingTodayOverview - Loading state for today's overview
 * @returns {TodayOverviewProps} todayOverview - Today's overview data with fallbacks
 * @returns {Function} refetchAllData - Function to refetch all dashboard data
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
   * Initialize notifications when the dashboard loads
   * Check that the notification permission has been initialized before and the
   * expo push token has been sent to the server, and that the notification service has been initialized
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
   * Refetch All Dashboard Data
   *
   * This function triggers a refresh of all dashboard data by calling
   * the refetch function for each API endpoint. It's used for manual
   * data refresh scenarios like pull-to-refresh.
   *
   * @returns {Promise<void>} Promise that resolves when all refetch operations complete
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
   * Call the detailer using the phone number. this method will take the user out of the app
   * and into their dialer
   * @param phoneNumber - The phone number to call
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
