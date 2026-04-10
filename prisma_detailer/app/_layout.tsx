import { Stack } from "expo-router";
import { Provider } from "react-redux";
import store from "./store/my_store";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ThemeProvider, { useThemeContext } from "./contexts/ThemeProvider";
import AuthContextProvider from "./contexts/AuthContextProvider";
import { AlertProvider } from "./contexts/AlertContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SnackbarProvider } from "./contexts/SnackbarContext";
import { useUpdateMonitor } from "@/hooks/useUpdateMonitor";

function AppContent() {
  const backgroundColor = useThemeColor({}, "background");
  const {currentTheme} = useThemeContext();
  useUpdateMonitor();
  return (
    <>
      <StatusBar
        barStyle={currentTheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={backgroundColor}
      />
      <SnackbarProvider>
        <AuthContextProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="main" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
            </Stack>
          </GestureHandlerRootView>
        </AuthContextProvider>
      </SnackbarProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ThemeProvider>
          <AlertProvider>
            <AppContent />
          </AlertProvider>
        </ThemeProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
