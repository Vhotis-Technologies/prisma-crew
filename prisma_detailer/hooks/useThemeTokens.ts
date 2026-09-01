/**
 * Full token set for the active theme (colours + spacing/type).
 * Prefer this in new system primitives; keep `useThemeColor` for legacy screens.
 */
import { useColorScheme } from "react-native";
import { Colors } from "@/constants/Colors";
import {
  Dock,
  FontFamily,
  Radius,
  Spacing,
  TapTarget,
  Type,
} from "@/constants/theme";
import { useThemeContext } from "@/app/contexts/ThemeProvider";

/** Colours, spacing, radius, and type for the current light/dark scheme. */
export function useThemeTokens() {
  const system = useColorScheme();
  const { currentTheme } = useThemeContext();
  const scheme: "light" | "dark" =
    currentTheme === "dark" || currentTheme === "light"
      ? currentTheme
      : system === "dark"
        ? "dark"
        : "light";
  const colors = Colors[scheme];

  return {
    scheme,
    colors,
    spacing: Spacing,
    radius: Radius,
    type: Type,
    font: FontFamily,
    tap: TapTarget,
    dock: Dock,
  };
}
