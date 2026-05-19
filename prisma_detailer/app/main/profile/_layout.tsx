import { View } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";

const ProfileLayout = () => {
  const backgroundColor = useThemeColor({}, "background");
  return (
    <View style={{ flex: 1, backgroundColor }}>
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
    </View>
  );
};

export default ProfileLayout;
