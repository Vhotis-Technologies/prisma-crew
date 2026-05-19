import { StyleSheet, View, Pressable, StatusBar } from "react-native";
import React from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router, usePathname, Stack } from "expo-router";
import StyledText from "@/app/components/helpers/StyledText";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Divider } from "react-native-paper";
import { RootState, useAppSelector } from "../store/my_store";
import { useNotification } from "../app-hooks/useNotification";
import LinearGradientComponent from "../components/helpers/LinearGradientComponent";
import { useThemeContext } from "../contexts/ThemeProvider";
import { BlurView } from "expo-blur";
import { BackButton } from "@/app/components/helpers/BackButton";

const CustomHeader = ({ name }: { name: string }) => {
  const { unreadCount } = useNotification();
  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icons");
  const textColor = useThemeColor({}, "text");

  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View style={styles.headerButtons}>
        <BackButton />
        <StyledText variant="titleMedium" style={{ color: textColor }}>
          {name}
        </StyledText>
      </View>
      <View style={styles.headerButtons}>
        <View style={styles.notificationContainer}>
          <Pressable
            style={[
              styles.profileButton,
              { backgroundColor, shadowColor: textColor },
            ]}
            onPress={() => router.push("/main/settings/NotificationScreen")}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={iconColor}
            />
          </Pressable>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <StyledText variant="bodySmall" style={styles.unreadBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </StyledText>
            </View>
          )}
        </View>
        <Pressable
          style={[
            styles.profileButton,
            { backgroundColor, shadowColor: textColor },
          ]}
          onPress={() => router.push("/main/settings/SettingsScreen")}
        >
          <Ionicons name="settings-outline" size={24} color={iconColor} />
        </Pressable>
      </View>
    </View>
  );
};

export default function MainLayout() {
  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icons");
  const primaryColor = useThemeColor({}, "primary");
  const insets = useSafeAreaInsets();
  const { currentTheme } = useThemeContext();

  const TAB_BAR_HEIGHT = 50;
  const user = useAppSelector((state: RootState) => state.auth.user);
  const pathname = usePathname();

  const isDashboardActive =
    pathname.includes("/dashboard") ||
    pathname === "/main" ||
    pathname.endsWith("/main");
  const isAppointmentsActive = pathname.includes("/appointments");
  const isEarningsActive = pathname.includes("/earnings");
  const isProfileActive = pathname.includes("/profile");

  const displayName = user?.first_name
    ? `Hi there, ${user.first_name}`
    : "Hi there";

  return (
    <SafeAreaView style={[styles.mainContainer, { backgroundColor }]}>
        <StatusBar
          barStyle={
            currentTheme === "dark" ? "light-content" : "dark-content"
          }
        />
        <CustomHeader name={displayName} />
        <Divider style={{ marginTop: 5, marginBottom: 5 }} />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="appointments" options={{ headerShown: false }} />
            <Stack.Screen name="dashboard" options={{ headerShown: false }} />
            <Stack.Screen name="earnings" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
        </View>

        <BlurView
          intensity={10}
          tint={currentTheme === "dark" ? "dark" : "light"}
          style={[
            styles.bottomNavWrapper,
            { bottom: 5 + (insets.bottom ?? 0) },
          ]}
        >
          <LinearGradientComponent
            color1={backgroundColor}
            color2={primaryColor}
            start={{ x: 0, y: 3 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.floatingBottomTabContainer,
              { maxHeight: TAB_BAR_HEIGHT },
            ]}
          >
            <Pressable
              onPress={() => router.push("/main/dashboard/DashboardScreen")}
              style={[
                styles.floatingBottomButtons,
                isDashboardActive && {
                  backgroundColor: primaryColor + "50",
                },
              ]}
            >
              <Ionicons
                name={isDashboardActive ? "home" : "home-outline"}
                size={24}
                color={isDashboardActive ? primaryColor : iconColor}
              />
            </Pressable>
            <Pressable
              onPress={() =>
                router.push("/main/appointments/AppointmentCalendarScreen")
              }
              style={[
                styles.floatingBottomButtons,
                isAppointmentsActive && {
                  backgroundColor: primaryColor + "30",
                },
              ]}
            >
              <Ionicons
                name={isAppointmentsActive ? "calendar" : "calendar-outline"}
                size={24}
                color={isAppointmentsActive ? primaryColor : iconColor}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/main/earnings/EarningScreen")}
              style={[
                styles.floatingBottomButtons,
                isEarningsActive && {
                  backgroundColor: primaryColor + "30",
                },
              ]}
            >
              <Ionicons
                name={isEarningsActive ? "wallet" : "wallet-outline"}
                size={24}
                color={isEarningsActive ? primaryColor : iconColor}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/main/profile/ProfileScreen")}
              style={[
                styles.floatingBottomButtons,
                isProfileActive && {
                  backgroundColor: primaryColor + "30",
                },
              ]}
            >
              <Ionicons
                name={isProfileActive ? "person" : "person-outline"}
                size={24}
                color={isProfileActive ? primaryColor : iconColor}
              />
            </Pressable>
          </LinearGradientComponent>
        </BlurView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileButton: {
    padding: 8,
    borderRadius: 30,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  notificationContainer: {
    position: "relative",
  },
  unreadBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "RobotoMedium",
    color: "white",
  },
  floatingBottomTabContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 15,
    borderRadius: 30,
    maxWidth: "80%",
    alignItems: "center",
  },
  bottomNavWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  floatingBottomButtons: {
    padding: 12,
    borderRadius: 25,
  },
});
