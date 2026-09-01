import { StyleSheet, View, StatusBar } from "react-native";
import { Stack, router, usePathname } from "expo-router";
import { useThemeContext } from "../contexts/ThemeProvider";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { BottomDock } from "@/app/components/ui/system";
import { CrewRoutes } from "./crewRoutes";

const HIDE_DOCK =
  /AppointmentDetails|SettingsScreen|NotificationScreen|AvailabilityScreen|JobHistoryScreen|SupportChatScreen/;

export default function MainLayout() {
  const { colors } = useThemeTokens();
  const { currentTheme } = useThemeContext();
  const pathname = usePathname();
  const showDock = !HIDE_DOCK.test(pathname);

  const isToday =
    pathname.includes("/today") ||
    pathname === "/main" ||
    pathname.endsWith("/main");
  const isSchedule =
    pathname.includes("/schedule") || pathname.includes("/appointments");
  const isMe = pathname.includes("/me") || pathname.includes("/profile");

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <StatusBar
        barStyle={currentTheme === "dark" ? "light-content" : "dark-content"}
      />
      <View style={styles.body}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="today" />
          <Stack.Screen name="schedule" />
          <Stack.Screen name="me" />
          <Stack.Screen name="appointments" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="support" />
        </Stack>
      </View>
      {showDock ? (
        <BottomDock
          items={[
            {
              key: "today",
              label: "Today",
              icon: "home-outline",
              iconActive: "home",
              active: isToday && !isSchedule && !isMe,
              onPress: () => router.replace(CrewRoutes.today),
            },
            {
              key: "schedule",
              label: "Schedule",
              icon: "calendar-outline",
              iconActive: "calendar",
              active: isSchedule && !isMe,
              onPress: () => router.replace(CrewRoutes.schedule),
            },
            {
              key: "me",
              label: "Me",
              icon: "person-outline",
              iconActive: "person",
              active: isMe,
              onPress: () => router.replace(CrewRoutes.me),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
