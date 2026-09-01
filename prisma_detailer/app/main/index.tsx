import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { CrewRoutes } from "./crewRoutes";
import { useThemeTokens } from "@/hooks/useThemeTokens";

/** Default main route: Today. */
export default function MainIndex() {
  const { colors } = useThemeTokens();
  useEffect(() => {
    router.replace(CrewRoutes.today);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={colors.button} />
    </View>
  );
}
