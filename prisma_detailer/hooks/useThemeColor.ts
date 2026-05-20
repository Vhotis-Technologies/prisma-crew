/**
 * Resolves a themed color from `Colors` or optional light/dark overrides.
 * Uses ThemeProvider when available; falls back to system color scheme.
 */

import { useColorScheme } from "react-native";
import { Colors } from "@/constants/Colors";
import { useThemeContext } from "@/app/contexts/ThemeProvider";

/** Return the color for the active theme, preferring `props.light` / `props.dark` when set. */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  // Use the theme context if available, otherwise fall back to system color scheme
  try {
    const { currentTheme } = useThemeContext();
    const theme = currentTheme;
    const colorFromProps = props[theme];

    if (colorFromProps) {
      return colorFromProps;
    } else {
      return Colors[theme][colorName];
    }
  } catch (error) {
    // Fallback to system color scheme if context is not available
    const theme = useColorScheme() ?? "light";
    const colorFromProps = props[theme];

    if (colorFromProps) {
      return colorFromProps;
    } else {
      return Colors[theme][colorName];
    }
  }
}
