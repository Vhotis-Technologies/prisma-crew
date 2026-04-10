import { UserProfileProps } from "@/app/interfaces/ProfileInterfaces";
import * as SecureStore from "expo-secure-store";

/**
 * Save the user data to the async storage after login.
 * This is used when the user tries to relogin,
 * @param user The returned user data which is of interface {User | Seller}
 * @param access The access token returned from the server
 * @param refresh The refresh token returned from the server
 * @param pushToken Optional push notification token to store
 */
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

/**
 * Retrieve user data from storage
 * @returns Promise<UserProfileProps | null> - Returns user data if found, null otherwise
 */
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

/**
 * Save push notification token to storage
 * @param token The push notification token to save
 * @returns Promise<boolean> - Success status
 */
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

/**
 * Retrieve push notification token from storage
 * @returns Promise<string | null> - Returns push token if found, null otherwise
 */
export const getPushTokenFromStorage = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync("push_token");
    return token;
  } catch (error) {
    console.error("Error retrieving push token from storage:", error);
    return null;
  }
};

/**
 * Check if push token has been saved to server
 * @returns Promise<boolean> - Returns true if token was saved to server
 */
export const isPushTokenSavedToServer = async (): Promise<boolean> => {
  try {
    const saved = await SecureStore.getItemAsync("push_token_saved_to_server");
    return saved === "true";
  } catch (error) {
    console.error("Error checking push token server save status:", error);
    return false;
  }
};

/**
 * Clear push token from storage (used during logout)
 * @returns Promise<boolean> - Success status
 */
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
