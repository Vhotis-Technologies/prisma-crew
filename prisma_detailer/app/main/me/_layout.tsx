import { Stack } from "expo-router";

export default function MeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MeScreen" />
      <Stack.Screen name="JobHistoryScreen" />
    </Stack>
  );
}
