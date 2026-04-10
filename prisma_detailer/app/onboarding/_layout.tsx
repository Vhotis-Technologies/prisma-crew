import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../components/helpers/StyledText";

const OnboardingLayout = () => {
  const backgroundColor = useThemeColor({}, "background");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SignUpScreen" options={{ headerShown: false }} />
          <Stack.Screen name="SigninScreen" options={{ headerShown: false }} />
          <Stack.Screen
            name="ForgotPasswordScreen"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ResetPasswordScreen"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PendingApprovalScreen"
            options={{ headerShown: false }}
          />
        </Stack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OnboardingLayout;

const styles = StyleSheet.create({});
