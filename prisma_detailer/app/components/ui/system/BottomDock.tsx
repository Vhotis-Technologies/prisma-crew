/**
 * BottomDock — Today / Schedule / Me tab bar.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "./CrewText";

export type DockItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
};

type BottomDockProps = {
  items: DockItem[];
};

export function BottomDock({ items }: BottomDockProps) {
  const { colors, dock, spacing } = useThemeTokens();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.cards,
          borderTopColor: colors.borders,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          minHeight: dock.height + Math.max(insets.bottom, spacing.xs),
        },
      ]}
    >
      {items.map((item) => {
        const active = Boolean(item.active);
        const color = active ? colors.primary : colors.icons;
        const iconName = active && item.iconActive ? item.iconActive : item.icon;
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={({ pressed }) => [
              styles.item,
              {
                minHeight: dock.height,
                borderRadius: 10,
                marginHorizontal: 6,
                marginVertical: 4,
                backgroundColor: active ? colors.primarySoft : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name={iconName} size={dock.iconSize} color={color} />
            <CrewText variant="caption" color={color} style={active ? styles.activeLabel : undefined}>
              {item.label}
            </CrewText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  activeLabel: {
    fontFamily: "BarlowMedium",
  },
});
