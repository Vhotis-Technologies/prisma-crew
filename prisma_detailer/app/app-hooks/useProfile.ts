import {
  useGetProfileStatisticsQuery,
  useUpdatePushNotificationTokenMutation,
  useUpdateEmailNotificationTokenMutation,
  useUpdateMarketingEmailTokenMutation,
} from "../store/api/profileapi";
import { router } from "expo-router";
import { useAuthContext } from "../contexts/AuthContextProvider";
import { useAlertContext } from "../contexts/AlertContext";
import { UserProfileProps } from "../interfaces/ProfileInterfaces";
import { useAppSelector, useAppDispatch, RootState } from "../store/my_store";
import { useState, useEffect } from "react";
import { getUserFromStorage } from "../utils/storage";
import { setUser } from "../store/slices/authSlice";

const useProfile = () => {
  const dispatch = useAppDispatch();
  const {
    data: profileStatistics,
    isLoading: isProfileStatisticsLoading,
    error: profileStatisticsError,
  } = useGetProfileStatisticsQuery();
  /* Import the current user from the auth slice */
  const currentUser = useAppSelector((state: RootState) => state.auth.user);

  const [userFromStorage, setUserFromStorage] =
    useState<UserProfileProps | null>(null);

  // Load user data from storage if not available in state
  useEffect(() => {
    const loadUserFromStorage = async () => {
      if (!currentUser && !userFromStorage) {
        try {
          const storedUser = await getUserFromStorage();
          if (storedUser) {
            setUserFromStorage(storedUser);
          }
        } catch (error) {
          console.error("Error loading user from storage:", error);
        }
      }
    };
    loadUserFromStorage();
  }, [currentUser, userFromStorage]);

  const [
    updatePushNotificationTokenMutation,
    { isLoading: isLoadingUpdatePushNotificationToken },
  ] = useUpdatePushNotificationTokenMutation();
  const [
    updateEmailNotificationTokenMutation,
    { isLoading: isLoadingUpdateEmailNotificationToken },
  ] = useUpdateEmailNotificationTokenMutation();
  const [
    updateMarketingEmailTokenMutation,
    { isLoading: isLoadingUpdateMarketingEmailToken },
  ] = useUpdateMarketingEmailTokenMutation();

  const { handleLogout } = useAuthContext();
  const { setAlertConfig, setIsVisible } = useAlertContext();

  /**
   * The method is designed to handle the actions that are performed when clicked
   * @param action the actions to be performed when clicked
   */
  const handleActions = (action: string) => {
    switch (action) {
      case "availability":
        router.push("/main/profile/AvailabilityScreen");
        break;
      case "bankAccount":
        router.push("/main/profile/BankAccountScreen");
        break;
      case "helpSupport":
        break;
      case "notifications":
        router.push("/main/settings/NotificationScreen");
        break;
      case "earnings":
        router.push("/main/earnings/EarningScreen");
        break;
      case "logout":
        handleLogout();
        break;
    }
  };

  /**
   * Update push notification setting on the server
   * @param value - The new boolean value for push notifications
   * @returns Promise<boolean> - Returns true if successful, false otherwise
   */
  const updatePushNotificationSetting = async (
    value: boolean
  ): Promise<boolean> => {
    try {
      const response = await updatePushNotificationTokenMutation({
        update: value,
      }).unwrap();
      if (response.success) {
        // Push notification setting updated

        // Update the Redux store with the new value
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            allow_push_notifications: value,
          };
          dispatch(setUser(updatedUser));
        }

        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Error updating push notification setting:", error);
      setAlertConfig({
        title: "Error",
        message: "Failed to update push notification setting",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return false;
    }
  };

  /**
   * Update email notification setting on the server
   * @param value - The new boolean value for email notifications
   * @returns Promise<boolean> - Returns true if successful, false otherwise
   */
  const updateEmailNotificationSetting = async (
    value: boolean
  ): Promise<boolean> => {
    try {
      const response = await updateEmailNotificationTokenMutation({
        update: value,
      }).unwrap();
      if (response.success) {
        // Email notification setting updated

        // Update the Redux store with the new value
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            allow_email_notifications: value,
          };
          dispatch(setUser(updatedUser));
        }

        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Error updating email notification setting:", error);
      setAlertConfig({
        title: "Error",
        message: "Failed to update email notification setting",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return false;
    }
  };

  // Use user from state first, then fallback to storage
  const user = currentUser || userFromStorage;

  const userProfile: UserProfileProps = {
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    post_code: user?.post_code || "",
    country: user?.country || "",
    allow_push_notifications: user?.allow_push_notifications || false,
    allow_email_notifications: user?.allow_email_notifications || false,
    allow_marketing_emails: user?.allow_marketing_emails || false,
  };

  /**
   * Update marketing email setting on the server
   * @param value - The new boolean value for marketing emails
   * @returns Promise<boolean> - Returns true if successful, false otherwise
   */
  const updateMarketingEmailSetting = async (
    value: boolean
  ): Promise<boolean> => {
    try {
      const response = await updateMarketingEmailTokenMutation({
        update: value,
      }).unwrap();
      if (response.success) {
        // Marketing email setting updated

        // Update the Redux store with the new value
        if (currentUser) {
          const updatedUser = { ...currentUser, allow_marketing_emails: value };
          dispatch(setUser(updatedUser));
        }

        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Error updating marketing email setting:", error);
      setAlertConfig({
        title: "Error",
        message: "Failed to update marketing email setting",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return false;
    }
  };

  return {
    userProfile,
    profileStatistics,
    isProfileStatisticsLoading,
    profileStatisticsError,
    handleActions,
    updatePushNotificationSetting,
    updateEmailNotificationSetting,
    updateMarketingEmailSetting,
    isLoadingUpdatePushNotificationToken,
    isLoadingUpdateEmailNotificationToken,
    isLoadingUpdateMarketingEmailToken,
    updatePushNotificationTokenMutation,
    updateEmailNotificationTokenMutation,
    updateMarketingEmailTokenMutation,
  };
};

export default useProfile;
