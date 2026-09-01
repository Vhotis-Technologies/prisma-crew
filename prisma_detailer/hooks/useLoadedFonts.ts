/**
 * Loads app font families via Expo Font; used by ThemeProvider before rendering children.
 */
import { useFonts } from "expo-font";

/** Returns true when all bundled fonts have finished loading. */
export const useLoadedFonts = () => {
  const [fontsLoaded] = useFonts({
    SpaceMonoRegular: require("@/assets/fonts/SpaceMono-Regular.ttf"),
    BarlowRegular: require("@/assets/fonts/Barlow-Regular.ttf"),
    BarlowLight: require("@/assets/fonts/Barlow-Light.ttf"),
    BarlowMedium: require("@/assets/fonts/Barlow-Medium.ttf"),
    RobotoMedium: require("@/assets/fonts/Roboto-Medium.ttf"),
  });
  return fontsLoaded;
};
