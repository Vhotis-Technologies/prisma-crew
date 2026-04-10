import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { useAlertContext } from "@/app/contexts/AlertContext";

export const useUpdateMonitor = () => {
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { setAlertConfig } = useAlertContext();

  useEffect(() => {
    const checkForUpdates = async () => {
      // Skip update checks in development
      if (__DEV__) {
        return;
      }

      // Check if updates are enabled
      if (!Updates.isEnabled) {
        return;
      }

      try {
        setIsCheckingForUpdate(true);
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          setUpdateAvailable(true);

          setAlertConfig({
            isVisible: true,
            title: "Update Available",
            message:
              "A new version of the app is available. Would you like to download and install it now?",
            type: "warning",
            onClose: () => {},
            onConfirm: async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (error) {
                setAlertConfig({
                  isVisible: true,
                  title: "Update Failed",
                  message:
                    "Failed to install update. Please try again later.",
                  type: "error",
                  onConfirm: () => {},
                });
              }
            },
          });
        }
      } catch (error: any) {
        if (__DEV__) {
          setAlertConfig({
            isVisible: true,
            title: "Update Check Failed",
            message: error.message,
            type: "error",
            onConfirm: () => {},
          });
        }
      } finally {
        setIsCheckingForUpdate(false);
      }
    };

    // Check for updates on app start
    checkForUpdates();

    // Set up periodic checks (every 5 minutes) - only in production
    if (!__DEV__) {
      const interval = setInterval(checkForUpdates, 300000);
      return () => clearInterval(interval);
    }
  }, []);

  return {
    isCheckingForUpdate,
    updateAvailable,
  };
};
