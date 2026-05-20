/**
 * Auth context: login, logout, session restore, permissions, and location on login.
 */
import React, { createContext, useContext } from "react";
// import * as SecureStore from "expo-secure-store";
import { useAlertContext } from "./AlertContext";
import { useAppDispatch } from "@/app/store/my_store";
import {
  logout,
  setIsAuthenticated,
  setUser,
  setAccessToken,
  setRefreshToken,
} from "@/app/store/slices/authSlice";
import { useLoginMutation } from "@/app/store/api/authApi";
import { useUpdateLocationMutation } from "@/app/store/api/profileapi";
import { UserProfileProps } from "@/app/interfaces/ProfileInterfaces";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { usePermissions } from "@/app/app-hooks/usePermissions";
import {
  saveDataToStorage,
  getPushTokenFromStorage,
  clearPushTokenFromStorage,
} from "../utils/storage";

interface AuthContextType {
  handleLogin: (
    email: string,
    password: string,
    rememberMe: boolean,
  ) => Promise<void>;
  handleLogout: () => void;
  isLoading: boolean;
  isError: boolean;
  error: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Wraps the app with login/logout handlers and session restore on mount. */
const AuthContextProvider = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch();
  const { setIsVisible, setAlertConfig } = useAlertContext();

  /* Destructure the login mutation from the authApi */
  const [login, { isLoading, isError, error, status }] = useLoginMutation();
  const [updateLocation] = useUpdateLocationMutation();

  /* Get permission service for first-time setup */
  const { requestAllPermissions } = usePermissions();

  /** Restore session from SecureStore on mount and navigate to dashboard if valid. */
  React.useEffect(() => {
    const reauthenticateUser = async () => {
      const user = await SecureStore.getItemAsync("user");
      const storedAccess = await SecureStore.getItemAsync("access");
      const storedRefresh = await SecureStore.getItemAsync("refresh");
      const storedPushToken = await getPushTokenFromStorage();

      // Check if the user is authenticated.
      if (user && storedAccess && storedRefresh) {
        dispatch(setUser(JSON.parse(user)));
        dispatch(setAccessToken(storedAccess));
        dispatch(setRefreshToken(storedRefresh));
        dispatch(setIsAuthenticated(true));

        // Log push token status for debugging
        if (storedPushToken) {
          // User has stored push token, will skip re-registration
        } else {
          // No stored push token found, will register for notifications
        }

        router.replace("/main/dashboard/DashboardScreen");
      }
    };
    reauthenticateUser();
  }, []);

  /** Confirm logout, clear SecureStore and Redux, then navigate to sign-in. */
  const handleLogout = () => {
    setAlertConfig({
      title: "Logout",
      message: "Are you sure you want to logout?",
      type: "success",
      isVisible: true,
      onConfirm: async () => {
        try {
          await SecureStore.deleteItemAsync("user");
          await SecureStore.deleteItemAsync("access");
          await SecureStore.deleteItemAsync("refresh");
          await clearPushTokenFromStorage();
          dispatch(logout());
          // Navigate to signin page
          router.replace("/onboarding/SigninScreen");
        } catch (error) {
          console.error("Error during logout:", error);
        }
      },
      onClose: () => {
        setIsVisible(false);
      },
    });
  };

  /** Login with email/password; persist session if rememberMe; request permissions and report location. */
  const handleLogin = async (
    email: string,
    password: string,
    rememberMe: boolean,
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    const credentials = { email: normalizedEmail, password };
    // Process credentials
    try {
      const response = await login(credentials).unwrap();

      // The response from the server should contain user, access, and refresh
      if (response && response.user && response.access && response.refresh) {
        dispatch(setUser(response.user));
        dispatch(setIsAuthenticated(true));
        dispatch(setAccessToken(response.access));
        dispatch(setRefreshToken(response.refresh));

        if (rememberMe) {
          // Call the save function to save the user data to the secure store.
          const saved = await saveDataToStorage(
            response.user,
            response.access,
            response.refresh,
          );
          if (saved) {
            // Request permissions after successful login
            await requestAllPermissions();
            // Report current location for Redis GEO (throttled: once per login)
            try {
              const { status: locStatus } =
                await Location.getForegroundPermissionsAsync();
              if (locStatus === "granted") {
                const pos = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                if (pos?.coords?.latitude != null && pos?.coords?.longitude != null) {
                  await updateLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  }).unwrap();
                }
              }
            } catch (_) {
              // Do not block login if location fails
            }
            router.replace("/main/dashboard/DashboardScreen");
          }
        } else {
          // Request permissions after successful login
          await requestAllPermissions();
          // Report current location for Redis GEO (throttled: once per login)
          try {
            const { status: locStatus } =
              await Location.getForegroundPermissionsAsync();
            if (locStatus === "granted") {
              const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              if (pos?.coords?.latitude != null && pos?.coords?.longitude != null) {
                await updateLocation({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                }).unwrap();
              }
            }
          } catch (_) {
            // Do not block login if location fails
          }
          router.replace("/main/dashboard/DashboardScreen");
        }
      } else {
        setAlertConfig({
          title: "Login Failed",
          message:
            "Please check your email and confirm your password again.\n\nIf you have forgotten your password, please reset it.",
          type: "error",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
          },
        });
      }
    } catch (error: any) {
      // Debug: log the error structure

      let errorMessage =
        "Please check your email and confirm your password again.\nIf you have forgotten your password, please reset it.";

      // Parse error message from different response structures
      if (error?.data) {
        // Handle array format (common for ValidationError)
        if (Array.isArray(error.data)) {
          errorMessage = error.data[0] || errorMessage;
        }
        // Handle non_field_errors (common for serializer ValidationError)
        else if (
          error.data.non_field_errors &&
          Array.isArray(error.data.non_field_errors)
        ) {
          errorMessage = error.data.non_field_errors[0] || errorMessage;
        }
        // Handle object with detail field
        else if (error.data.detail) {
          errorMessage = Array.isArray(error.data.detail)
            ? error.data.detail[0]
            : error.data.detail;
        }
        // Handle object with error field
        else if (error.data.error) {
          errorMessage = error.data.error;
        }
        // Handle if data itself is a string
        else if (typeof error.data === "string") {
          errorMessage = error.data;
        }
      }
      // Fallback to nested response structure (legacy)
      else if (error?.response?.data) {
        if (Array.isArray(error.response.data)) {
          errorMessage = error.response.data[0] || errorMessage;
        } else if (
          error.response.data.non_field_errors &&
          Array.isArray(error.response.data.non_field_errors)
        ) {
          errorMessage =
            error.response.data.non_field_errors[0] || errorMessage;
        } else if (error.response.data.detail) {
          errorMessage = Array.isArray(error.response.data.detail)
            ? error.response.data.detail[0]
            : error.response.data.detail;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      }

      // Check if error is related to pending approval
      const errorMessageLower =
        typeof errorMessage === "string" ? errorMessage.toLowerCase() : "";
      if (
        errorMessageLower.includes("pending approval") ||
        errorMessageLower.includes("not verified") ||
        errorMessageLower.includes("admin approval")
      ) {
        // Navigate to pending approval screen instead of showing error
        router.push("/onboarding/PendingApprovalScreen");
        return;
      }

      setAlertConfig({
        title: "Login Failed",
        message: errorMessage,
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
    }
  };

  const value = {
    handleLogin,
    handleLogout,
    isLoading,
    isError,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Access login/logout and auth mutation state; requires `AuthContextProvider`. */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuthContext must be used within an AuthContextProvider",
    );
  }
  return context;
};

export default AuthContextProvider;
