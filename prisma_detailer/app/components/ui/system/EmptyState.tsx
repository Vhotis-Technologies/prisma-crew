/**
 * EmptyState — quiet field-app placeholder (no jobs, no notifications).
 */
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "./CrewText";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
};

export function EmptyState({
  icon = "file-tray-outline",
  title,
  body,
}: EmptyStateProps) {
  const { colors, spacing } = useThemeTokens();
  return (
    <View style={[styles.wrap, { gap: spacing.xs, padding: spacing.lg }]}>
      <Ionicons name={icon} size={36} color={colors.muted} />
      <CrewText variant="subtitle">{title}</CrewText>
      {body ? (
        <CrewText variant="body" muted style={{ textAlign: "center" }}>
          {body}
        </CrewText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
});
