/**
 * Today overview: current/next job, call client, push registration.
 */
import { useEffect, useCallback } from "react";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { useGetTodayOverviewQuery } from "../store/api/dashboardApi";
import { useAlertContext } from "../contexts/AlertContext";
import { useNotification } from "./useNotification";
import { useNotificationService } from "./useNotificationService";
import { usePermissions } from "./usePermissions";
import {
  getPushTokenFromStorage,
  isPushTokenSavedToServer,
} from "../utils/storage";

export const useDashboard = () => {
  const {
    data: todayOverview,
    isLoading: isLoadingTodayOverview,
    refetch: refetchTodayOverview,
  } = useGetTodayOverviewQuery();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const { refreshNotifications } = useNotification();
  const { expoPushToken, initializeNotificationService } =
    useNotificationService();
  const { requestNotificationPermission, permissionStatus } = usePermissions();

  useEffect(() => {
    const initializeNotifications = async () => {
      const storedToken = await getPushTokenFromStorage();
      const tokenSavedToServer = await isPushTokenSavedToServer();
      if (storedToken && tokenSavedToServer) return;

      const hasRequestedPermissions = await SecureStore.getItemAsync(
        "notification_permission_requested",
      );

      if (!hasRequestedPermissions) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await initializeNotificationService();
          await SecureStore.setItemAsync(
            "notification_permission_requested",
            "true",
          );
        }
      } else if (permissionStatus.notifications.granted && !expoPushToken) {
        await initializeNotificationService();
      }
    };

    initializeNotifications();
  }, []);

  const refetchAllData = useCallback(async () => {
    refetchTodayOverview();
    refreshNotifications();
  }, [refetchTodayOverview, refreshNotifications]);

  const callClient = useCallback(
    (phoneNumber: string) => {
      if (!phoneNumber) return;
      setAlertConfig({
        isVisible: true,
        title: "Call client?",
        message: `Call ${phoneNumber}?`,
        type: "warning",
        onConfirm() {
          Linking.openURL(`tel:${phoneNumber}`);
          setIsVisible(false);
        },
        onClose() {
          setIsVisible(false);
        },
      });
    },
    [setAlertConfig, setIsVisible],
  );

  return {
    isLoadingTodayOverview,
    todayOverview: todayOverview || {
      totalAppointments: 0,
      completedJobs: 0,
      pendingJobs: 0,
    },
    callClient,
    refetchAllData,
  };
};
