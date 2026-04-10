import { View } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";

const SettingsLayout = () => {
  const backgroundColor = useThemeColor({}, "background");
  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SettingsScreen" />
        <Stack.Screen name="NotificationScreen" />
        <Stack.Screen name="TrainingScreen" />
      </Stack>
    </View>
  );
};

export default SettingsLayout;
