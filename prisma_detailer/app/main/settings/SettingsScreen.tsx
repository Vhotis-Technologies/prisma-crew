/**
 * Settings — push/email, theme, location, support. No training or earnings.
 */
import { useEffect, useState } from "react";
import { View, Pressable, ScrollView, Switch, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Snackbar } from "react-native-paper";
import { Screen, CrewText, PrimaryButton } from "@/app/components/ui/system";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { useThemeContext } from "@/app/contexts/ThemeProvider";
import { useAuthContext } from "@/app/contexts/AuthContextProvider";
import useProfile from "@/app/app-hooks/useProfile";
import { usePermissions } from "@/app/app-hooks/usePermissions";
import { CrewRoutes } from "../crewRoutes";

export default function SettingsScreen() {
  const { colors, spacing, radius, tap } = useThemeTokens();
  const { theme, setTheme } = useThemeContext();
  const { handleLogout } = useAuthContext();
  const {
    userProfile,
    updatePushNotificationSetting,
    updateEmailNotificationSetting,
    isLoadingUpdatePushNotificationToken,
    isLoadingUpdateEmailNotificationToken,
  } = useProfile();
  const {
    toggleNotificationPermission,
    toggleLocationPermission,
    permissionStatus,
  } = usePermissions();

  const [emailNotifications, setEmailNotifications] = useState(
    userProfile.allow_email_notifications ?? false,
  );
  const [pushNotifications, setPushNotifications] = useState(
    !!(userProfile.allow_push_notifications && permissionStatus.notifications.granted),
  );
  const [locationServices, setLocationServices] = useState(
    permissionStatus.location.granted,
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
        ),
      );
    }
  }, [userProfile, permissionStatus.notifications.granted]);

  useEffect(() => {
    setLocationServices(permissionStatus.location.granted);
  }, [permissionStatus.location.granted]);

  const toast = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const toggleEmail = async (value: boolean) => {
    setEmailNotifications(value);
    const ok = await updateEmailNotificationSetting(value);
    if (!ok) {
      setEmailNotifications(!value);
      toast("Could not update email notifications.");
      return;
    }
    toast(value ? "Email notifications on." : "Email notifications off.");
  };

  const togglePush = async (value: boolean) => {
    setPushNotifications(value);
    if (value) {
      const granted = await toggleNotificationPermission(true);
      if (!granted) {
        setPushNotifications(false);
        toast(
          permissionStatus.notifications.canAskAgain
            ? "Permission denied. Try again or enable in device settings."
            : "Enable notifications in device settings.",
        );
        return;
      }
      const ok = await updatePushNotificationSetting(true);
      if (!ok) {
        setPushNotifications(false);
        toast("Could not update push notifications.");
        return;
      }
      toast("Push notifications enabled.");
      return;
    }
    const ok = await updatePushNotificationSetting(false);
    if (!ok) {
      setPushNotifications(true);
      toast("Could not update push notifications.");
      return;
    }
    toast("Push notifications disabled.");
  };

  const toggleLocation = async (value: boolean) => {
    if (value) {
      const ok = await toggleLocationPermission(true);
      toast(ok ? "Location enabled." : "Could not enable location.");
    } else {
      await toggleLocationPermission(false);
      toast("Disable location in device settings.");
    }
  };

  const name =
    [userProfile.first_name, userProfile.last_name].filter(Boolean).join(" ") ||
    "Crew member";

  return (
    <Screen padded={false} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            style={[
              styles.back,
              { borderColor: colors.borders, backgroundColor: colors.cards },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <CrewText variant="title">Settings</CrewText>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cards,
              borderColor: colors.borders,
              borderRadius: radius.md,
              padding: spacing.md,
            },
          ]}
        >
          <CrewText variant="subtitle">{name}</CrewText>
          <CrewText variant="caption" muted>
            {userProfile.email}
          </CrewText>
        </View>

        <CrewText variant="label" muted>
          Notifications
        </CrewText>
        <ToggleRow
          title="Email"
          hint="Job updates by email"
          value={emailNotifications}
          onValueChange={toggleEmail}
          disabled={isLoadingUpdateEmailNotificationToken}
        />
        <ToggleRow
          title="Push"
          hint="Alerts on this device"
          value={pushNotifications}
          onValueChange={togglePush}
          disabled={isLoadingUpdatePushNotificationToken}
        />

        <CrewText variant="label" muted>
          Theme
        </CrewText>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {(["light", "dark", "system"] as const).map((option) => {
            const on = theme === option;
            return (
              <Pressable
                key={option}
                onPress={() => setTheme(option)}
                style={{
                  flex: 1,
                  minHeight: tap.min,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.borders,
                  backgroundColor: on ? colors.primary : colors.cards,
                }}
              >
                <CrewText
                  variant="label"
                  color={on ? colors.buttonText : colors.text}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </CrewText>
              </Pressable>
            );
          })}
        </View>

        <ToggleRow
          title="Location"
          hint="Used to match nearby jobs"
          value={locationServices}
          onValueChange={toggleLocation}
        />

        <Pressable
          onPress={() => router.push(CrewRoutes.supportChat)}
          style={[
            styles.card,
            {
              backgroundColor: colors.cards,
              borderColor: colors.borders,
              borderRadius: radius.md,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <CrewText variant="subtitle">Help & support</CrewText>
            <CrewText variant="caption" muted>
              Message the team
            </CrewText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <PrimaryButton label="Sign out" variant="ghost" onPress={handleLogout} />
      </ScrollView>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </Screen>
  );
}

function ToggleRow({
  title,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, radius, spacing } = useThemeTokens();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cards,
          borderColor: colors.borders,
          borderRadius: radius.md,
          padding: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <CrewText variant="subtitle">{title}</CrewText>
        <CrewText variant="caption" muted>
          {hint}
        </CrewText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borders, true: colors.primary }}
        thumbColor={colors.buttonText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
  },
});
