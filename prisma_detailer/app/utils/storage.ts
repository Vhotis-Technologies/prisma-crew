/**
 * SecureStore helpers: session tokens, user profile, and push notification token.
 */
import { UserProfileProps } from "@/app/interfaces/ProfileInterfaces";
import * as SecureStore from "expo-secure-store";

/** Persist user, access/refresh tokens, and optional push token after login. */
export const saveDataToStorage = async (
  user: UserProfileProps | null,
  access: string,
  refresh: string,
  pushToken?: string
) => {
  try {
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    await SecureStore.setItemAsync("access", access);
    await SecureStore.setItemAsync("refresh", refresh);
    if (pushToken) {
      await SecureStore.setItemAsync("push_token", pushToken);
    }
    // Data saved to storage
    return true;
  } catch (error) {
    console.error("Error saving data to storage:", error);
    return false;
  }
};

/** Read parsed user profile from SecureStore, or null if missing. */
export const getUserFromStorage =
  async (): Promise<UserProfileProps | null> => {
    try {
      const userData = await SecureStore.getItemAsync("user");
      if (userData) {
        return JSON.parse(userData);
      }
      return null;
    } catch (error) {
      console.error("Error retrieving user data from storage:", error);
      return null;
    }
  };

/** Save push token and mark it as registered on the server. */
export const savePushTokenToStorage = async (
  token: string
): Promise<boolean> => {
  try {
    await SecureStore.setItemAsync("push_token", token);
    await SecureStore.setItemAsync("push_token_saved_to_server", "true");
    // Push token saved to storage
    return true;
  } catch (error) {
    console.error("Error saving push token to storage:", error);
    return false;
  }
};

/** Read stored Expo push token, or null. */
export const getPushTokenFromStorage = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync("push_token");
    return token;
  } catch (error) {
    console.error("Error retrieving push token from storage:", error);
    return null;
  }
};

/** True if push token was previously synced to the backend. */
export const isPushTokenSavedToServer = async (): Promise<boolean> => {
  try {
    const saved = await SecureStore.getItemAsync("push_token_saved_to_server");
    return saved === "true";
  } catch (error) {
    console.error("Error checking push token server save status:", error);
    return false;
  }
};

/** Remove push token and server-sync flag (e.g. on logout). */
export const clearPushTokenFromStorage = async (): Promise<boolean> => {
  try {
    await SecureStore.deleteItemAsync("push_token");
    await SecureStore.deleteItemAsync("push_token_saved_to_server");
    return true;
  } catch (error) {
    console.error("Error clearing push token from storage:", error);
    return false;
  }
};
