/**
 * PrimaryButton — full-width purple CTA (Start, Complete, Save).
 * Use `secondary` for Navigate/Call; `ghost` for low emphasis.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "./CrewText";

type ButtonVariant = "primary" | "secondary" | "ghost";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Default true. Set false when placing buttons side by side. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
}: PrimaryButtonProps) {
  const { colors, radius, spacing, tap } = useThemeTokens();
  const idle = disabled || loading;

  const palette = {
    primary: {
      bg: colors.button,
      border: colors.button,
      text: colors.buttonText,
    },
    secondary: {
      bg: "transparent",
      border: colors.borders,
      text: colors.text,
    },
    ghost: {
      bg: "transparent",
      border: "transparent",
      text: colors.primary,
    },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={idle}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: idle, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          width: fullWidth ? "100%" : undefined,
          flex: fullWidth ? undefined : 1,
          minHeight: tap.button,
          borderRadius: radius.md,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "ghost" ? 0 : 1,
          opacity: idle ? 0.5 : pressed ? 0.85 : 1,
          gap: spacing.xs,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={[styles.row, { gap: spacing.xs }]}>
          {icon}
          <CrewText variant="button" color={palette.text}>
            {label}
          </CrewText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
