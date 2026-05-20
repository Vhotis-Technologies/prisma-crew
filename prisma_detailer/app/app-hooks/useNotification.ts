/**
 * Notifications list hook: fetch, filter, mark read, delete, and push token sync.
 */
import { useState, useEffect } from "react";
import {
  Notification,
  NotificationType,
  NotificationStatus,
  NotificationFilters,
} from "../interfaces/NotificationInterface";
import {
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useDeleteNotificationMutation,
  useSaveNotificationTokenMutation,
} from "@/app/store/api/notificationApi";
import { useNotificationService } from "./useNotificationService";
import {
  savePushTokenToStorage,
  isPushTokenSavedToServer,
  getPushTokenFromStorage,
} from "../utils/storage";
import { useAlertContext } from "../contexts/AlertContext";

/**
 * Manages in-app notifications and Expo push token persistence.
 * @returns Filtered notifications, counts, filters, and mutation helpers
 */
export const useNotification = () => {
  // Fetch notifications from the API
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch: refetchNotifications,
  } = useGetNotificationsQuery();

  // Get notification service for push token management
  const { expoPushToken } = useNotificationService();

  // Get AlertContext for showing error messages
  const { setAlertConfig, setIsVisible } = useAlertContext();

  /**
   * Process notifications by converting timestamp strings to Date objects.
   * This ensures consistent date handling throughout the application.
   */
  const processedNotifications = notifications.map((notification) => ({
    ...notification,
    timestamp: new Date(notification.timestamp),
  }));

  /**
   * State for managing notification filters.
   * Controls which notifications are displayed based on read status and type.
   */
  const [filters, setFilters] = useState<NotificationFilters>({
    showRead: true,
    showUnread: true,
    types: [],
  });

  /**
   * State to track if the push token has been saved to prevent duplicate saves.
   */
  const [tokenSaved, setTokenSaved] = useState(false);

  /**
   * State to track if the token is currently being saved.
   */
  const [isSavingToken, setIsSavingToken] = useState(false);

  /**
   * Apply read-status and type filters, sorted newest first.
   * @returns Filtered notification list
   */
  const getFilteredNotifications = (): Notification[] => {
    return processedNotifications
      .filter((notification) => {
        // Filter by read status
        if (!filters.showRead && notification.isRead) return false;
        if (!filters.showUnread && !notification.isRead) return false;

        // Filter by notification type
        if (
          filters.types.length > 0 &&
          !filters.types.includes(notification.type)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  /**
   * Mark one notification as read.
   * @param notificationId - Notification ID to update
   */
  const [markAsReadMutation] = useMarkNotificationAsReadMutation();
  const markAsRead = (notificationId: string) => {
    markAsReadMutation({ id: notificationId });
  };

  /** Mark all unread notifications as read in one batch. */
  const [markAllAsReadMutation] = useMarkAllNotificationsAsReadMutation();
  const markAllAsRead = () => {
    const unreadIds = processedNotifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);

    if (unreadIds.length > 0) {
      markAllAsReadMutation({ ids: unreadIds });
    }
  };

  /**
   * Delete a notification permanently.
   * @param notificationId - Notification ID to delete
   */
  const [deleteNotificationMutation] = useDeleteNotificationMutation();
  const deleteNotification = (notificationId: string) => {
    deleteNotificationMutation({ id: notificationId });
  };

  /**
   * Persist Expo push token to server and local storage once.
   * @param token - Expo push token
   * @returns True when saved successfully
   */
  const [saveNotificationTokenMutation] = useSaveNotificationTokenMutation();
  const saveNotificationToken = async (token: string): Promise<boolean> => {
    try {
      if (!token || tokenSaved || isSavingToken) {
        // Token already saved, invalid token, or currently saving
        return false;
      }

      const alreadySavedToServer = await isPushTokenSavedToServer();
      const previous = await getPushTokenFromStorage();
      if (alreadySavedToServer && previous === token) {
        setTokenSaved(true);
        return true;
      }

      setIsSavingToken(true);
      const result = await saveNotificationTokenMutation({ token }).unwrap();

      if (result.success) {
        setTokenSaved(true);
        // Save token to storage for future use
        await savePushTokenToStorage(token);
        return true;
      } else {
        // Show error alert
        setAlertConfig({
          isVisible: true,
          title: "Token Save Failed",
          message:
            "Failed to save push token: Server returned unsuccessful response",
          type: "error",
          onClose: () => setIsVisible(false),
        });
        return false;
      }
    } catch (error) {
      setAlertConfig({
        isVisible: true,
        title: "Token Save Error",
        message: `Error saving push token: ${error}`,
        type: "error",
        onClose: () => setIsVisible(false),
      });
      return false;
    } finally {
      setIsSavingToken(false);
    }
  };

  /** @returns Count of unread notifications */
  const getUnreadCount = (): number => {
    return processedNotifications.filter((notification) => !notification.isRead)
      .length;
  };

  /**
   * Merge partial filter updates into current filter state.
   * @param newFilters - Filter fields to update
   */
  const updateFilters = (newFilters: Partial<NotificationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  /**
   * Placeholder for future realtime notification ingestion.
   * @param notification - Notification payload without id/timestamp
   */
  const addNotification = (
    notification: Omit<Notification, "id" | "timestamp">
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    // TODO: Implement notification persistence when real-time notifications are added
  };

  /** Trigger a notifications query refetch. */
  const refreshNotifications = () => {
    refetchNotifications();
  };

  /**
   * Automatically save the push token when it becomes available.
   * This effect runs when the expoPushToken changes and saves it to the server.
   */
  useEffect(() => {
    if (expoPushToken && !tokenSaved) {
      saveNotificationToken(expoPushToken);
    }
  }, [expoPushToken, tokenSaved]);

  return {
    notifications: getFilteredNotifications(),
    allNotifications: processedNotifications,
    filters,
    unreadCount: getUnreadCount(),
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updateFilters,
    addNotification,
    refreshNotifications,
    saveNotificationToken,
    expoPushToken,
    tokenSaved,
    isSavingToken,
  };
};
