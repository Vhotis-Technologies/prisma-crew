/**
 * Screen — canvas background, safe area, optional scroll and page padding.
 */
import React from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import {
  SafeAreaView,
  type Edge,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useThemeTokens } from "@/hooks/useThemeTokens";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  /** Extra bottom space (e.g. tab dock). */
  dockInset?: boolean;
  footer?: React.ReactNode;
  style?: ViewStyle;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ["top"],
  dockInset = false,
  footer,
  style,
}: ScreenProps) {
  const { colors, spacing, dock } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const pad = padded ? spacing.md : 0;
  const bottomPad =
    (padded ? spacing.xl : 0) +
    (dockInset ? dock.height + insets.bottom : insets.bottom);

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        { paddingHorizontal: pad, paddingTop: pad, paddingBottom: bottomPad },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        {
          paddingHorizontal: pad,
          paddingTop: pad,
          paddingBottom: footer ? spacing.sm : bottomPad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.canvas }]}
      edges={edges}
    >
      {content}
      {footer ? (
        <View
          style={{
          paddingHorizontal: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
            backgroundColor: colors.canvas,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
