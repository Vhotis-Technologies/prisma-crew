/**
 * CrewText — Barlow type from design tokens (not Paper + BarlowLight).
 */
import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { Type } from "@/constants/theme";
import { useThemeTokens } from "@/hooks/useThemeTokens";

type CrewTextVariant = keyof typeof Type;

type CrewTextProps = TextProps & {
  variant?: CrewTextVariant;
  color?: string;
  muted?: boolean;
};

export function CrewText({
  variant = "body",
  color,
  muted,
  style,
  children,
  ...rest
}: CrewTextProps) {
  const { colors } = useThemeTokens();
  const tone: TextStyle = {
    color: color ?? (muted ? colors.muted : colors.text),
  };

  return (
    <Text style={[Type[variant], tone, style]} {...rest}>
      {children}
    </Text>
  );
}
