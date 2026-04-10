/**
 * Settings Screen – unified design (mimics client, no subscriptions)
 *
 * - Profile summary at top (avatar, name, email, Edit profile)
 * - PREFERENCES: notifications, language, theme, location
 * - ACCOUNT: Help & support (no subscription)
 * - Logout at bottom
 */

import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThemeContext } from "@/app/contexts/ThemeProvider";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SettingItem from "@/app/components/ui/settings/SettingItem";
import SettingLink from "@/app/components/ui/settings/SettingLink";
import StyledText from "@/app/components/helpers/StyledText";
import useProfile from "@/app/app-hooks/useProfile";
import { usePermissions } from "@/app/app-hooks/usePermissions";
import { useAuthContext } from "@/app/contexts/AuthContextProvider";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StyledButton from "@/app/components/helpers/StyledButton";

const SettingsScreen = () => {
  const { theme, setTheme } = useThemeContext();
  const { handleLogout } = useAuthContext();
  const {
    userProfile,
    updatePushNotificationSetting,
    updateEmailNotificationSetting,
    updateMarketingEmailSetting,
    isLoadingUpdatePushNotificationToken,
    isLoadingUpdateEmailNotificationToken,
    isLoadingUpdateMarketingEmailToken,
  } = useProfile();

  const {
    toggleNotificationPermission,
    toggleLocationPermission,
    permissionStatus,
  } = usePermissions();

  const [emailNotifications, setEmailNotifications] = useState(
    userProfile.allow_email_notifications ?? false
  );
  const [pushNotifications, setPushNotifications] = useState(
    !!(userProfile.allow_push_notifications && permissionStatus.notifications.granted)
  );
  const [marketingNotifications, setMarketingNotifications] = useState(
    userProfile.allow_marketing_emails ?? false
  );
  const [locationServices, setLocationServices] = useState(
    permissionStatus.location.granted
  );
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  useEffect(() => {
    if (userProfile) {
      setEmailNotifications(userProfile.allow_email_notifications ?? false);
      setPushNotifications(
        !!(
          userProfile.allow_push_notifications &&
          permissionStatus.notifications.granted
        )
      );
      setMarketingNotifications(userProfile.allow_marketing_emails ?? false);
    }
  }, [userProfile, permissionStatus.notifications.granted]);

  useEffect(() => {
    setLocationServices(permissionStatus.location.granted);
  }, [permissionStatus.location.granted]);

  const handleNotificationToggle = async (type: string, value: boolean) => {
    switch (type) {
      case "email":
        setEmailNotifications(value);
        break;
      case "push":
        setPushNotifications(value);
        break;
      case "marketing":
        setMarketingNotifications(value);
        break;
    }

    let success = false;
    switch (type) {
      case "email":
        success = await updateEmailNotificationSetting(value);
        break;
      case "push":
        if (value) {
          const permissionGranted = await toggleNotificationPermission(true);
          if (permissionGranted) {
            success = await updatePushNotificationSetting(true);
            setSnackbarMessage("Push notifications enabled.");
          } else {
            success = false;
            setSnackbarMessage(
              permissionStatus.notifications.canAskAgain
                ? "Permission denied. Try again or enable in device settings."
                : "Enable notifications in device settings."
            );
          }
        } else {
          success = await updatePushNotificationSetting(false);
          setSnackbarMessage("Push notifications disabled.");
        }
        break;
      case "marketing":
        success = await updateMarketingEmailSetting(value);
        break;
    }

    if (!success) {
      switch (type) {
        case "email":
          setEmailNotifications(!value);
          setSnackbarMessage("Failed to update email notifications.");
          break;
        case "push":
          setPushNotifications(!value);
          setSnackbarMessage("Failed to update push notifications.");
          break;
        case "marketing":
          setMarketingNotifications(!value);
          setSnackbarMessage("Failed to update marketing preference.");
          break;
      }
    } else {
      if (type === "email") {
        setSnackbarMessage(
          value ? "Email notifications on." : "Email notifications off."
        );
      } else if (type === "marketing") {
        setSnackbarMessage(
          value ? "Marketing emails on." : "Marketing emails off."
        );
      }
    }
    setSnackbarVisible(true);
  };

  const handleThemeToggle = (type: string, value: boolean) => {
    if (value) setTheme(type as "light" | "dark" | "system");
  };

  const handleGeneralToggle = async (type: string, value: boolean) => {
    if (type === "location") {
      if (value) {
        const success = await toggleLocationPermission(true);
        setSnackbarMessage(
          success ? "Location enabled." : "Failed to enable location."
        );
      } else {
        await toggleLocationPermission(false);
        setSnackbarMessage("Disable location in device settings.");
      }
      setSnackbarVisible(true);
    }
  };

  const displayName = [userProfile.first_name, userProfile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "—";

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const tintColor = useThemeColor({}, "tint");
  const sectionLabelColor = useThemeColor({}, "text");
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 50 },
        ]}
      >
        {/* Profile summary */}
        <Pressable
          style={[
            styles.profileBlock,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => router.push("/main/profile/ProfileScreen")}
        >
          <View style={[styles.avatar, { backgroundColor: tintColor }]}>
            <StyledText
              variant="titleMedium"
              style={{ color: backgroundColor }}
            >
              {userProfile.first_name?.charAt(0)?.toUpperCase() ?? "?"}
            </StyledText>
          </View>
          <View style={styles.profileInfo}>
            <StyledText
              variant="titleMedium"
              style={{ color: textColor }}
              numberOfLines={1}
            >
              {displayName}
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={[styles.email, { color: textColor }]}
              numberOfLines={1}
            >
              {userProfile.email ?? "—"}
            </StyledText>
          </View>
          <View style={styles.editRow}>
            <StyledText variant="labelMedium" style={{ color: primaryColor }}>
              Edit
            </StyledText>
            <Ionicons name="chevron-forward" size={18} color={primaryColor} />
          </View>
        </Pressable>

        {/* PREFERENCES */}
        <StyledText
          variant="labelSmall"
          style={[styles.sectionHeader, { color: sectionLabelColor }]}
        >
          PREFERENCES
        </StyledText>
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <SettingItem
            title="Email notifications"
            description="Updates and alerts via email"
            value={emailNotifications}
            onValueChange={(v) => handleNotificationToggle("email", v)}
            disabled={isLoadingUpdateEmailNotificationToken}
          />
          <SettingItem
            title="Push notifications"
            description="Instant alerts on your device"
            value={pushNotifications}
            onValueChange={(v) => handleNotificationToggle("push", v)}
            disabled={isLoadingUpdatePushNotificationToken}
          />
          <SettingItem
            title="Marketing communications"
            description="Promotions and offers"
            value={marketingNotifications}
            onValueChange={(v) => handleNotificationToggle("marketing", v)}
            disabled={isLoadingUpdateMarketingEmailToken}
          />
          <SettingLink
            title="Language"
            description="English"
            onPress={() => {}}
          />
          <View style={[styles.themeRow, { borderBottomColor: borderColor }]}>
            <View style={styles.themeLabels}>
              <StyledText variant="labelLarge" style={{ color: textColor }}>
                Theme
              </StyledText>
              <StyledText
                variant="bodySmall"
                style={{ color: textColor, opacity: 0.8 }}
              >
                {theme === "dark"
                  ? "Dark"
                  : theme === "light"
                    ? "Light"
                    : "System"}
              </StyledText>
            </View>
            <View style={styles.themeSegments}>
              <TouchableOpacity
                style={[
                  styles.segment,
                  theme === "dark" && { backgroundColor: primaryColor },
                  { borderColor },
                ]}
                onPress={() => handleThemeToggle("dark", true)}
              >
                <StyledText
                  variant="labelSmall"
                  style={{ color: theme === "dark" ? "#fff" : textColor }}
                >
                  Dark
                </StyledText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segment,
                  theme === "light" && { backgroundColor: primaryColor },
                  { borderColor },
                ]}
                onPress={() => handleThemeToggle("light", true)}
              >
                <StyledText
                  variant="labelSmall"
                  style={{ color: theme === "light" ? "#fff" : textColor }}
                >
                  Light
                </StyledText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segment,
                  theme === "system" && { backgroundColor: primaryColor },
                  { borderColor },
                ]}
                onPress={() => handleThemeToggle("system", true)}
              >
                <StyledText
                  variant="labelSmall"
                  style={{ color: theme === "system" ? "#fff" : textColor }}
                >
                  System
                </StyledText>
              </TouchableOpacity>
            </View>
          </View>
          <SettingItem
            title="Location services"
            description="Use your location for the app"
            value={locationServices}
            onValueChange={(v) => handleGeneralToggle("location", v)}
          />
        </View>

        {/* ACCOUNT – no subscription */}
        <StyledText
          variant="labelSmall"
          style={[styles.sectionHeader, { color: sectionLabelColor }]}
        >
          TRAINING & SUPPORT
        </StyledText>
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <SettingLink
            title="Training Center"
            description="Training and support resources"
            onPress={() => router.push("/main/settings/TrainingScreen")}
          />
          <SettingLink
            title="Help & Support"
            description="Get help and support"
            onPress={() => router.push("/main/settings/TrainingScreen")}
          />
        </View>

        {/* Logout */}
        <StyledButton
          children="Log out"
          onPress={handleLogout}
          variant="tonal"
        />
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  profileBlock: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  email: {
    opacity: 0.8,
    marginTop: 2,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionHeader: {
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    overflow: "hidden",
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  themeLabels: {
    flex: 1,
    marginRight: 16,
  },
  themeSegments: {
    flexDirection: "row",
    gap: 6,
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});
