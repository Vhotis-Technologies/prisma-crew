import {
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";

const ProfileLayout = () => {
  const backgroundColor = useThemeColor({}, "background");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ProfileScreen" options={{ headerShown: false }} />
          <Stack.Screen
            name="AvailabilityScreen"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BankAccountScreen"
            options={{ headerShown: false }}
          />
        </Stack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileLayout;

const styles = StyleSheet.create({});
