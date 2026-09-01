/**
 * Prisma Crew design tokens (Phase 0).
 *
 * Field-first: 10px brand radius, large tap targets, Barlow.
 * Import from here in new UI; do not copy hex/spacing into screens.
 */
import { TextStyle } from "react-native";
import { Colors, type ThemeColorName } from "./Colors";

export { Colors };
export type { ThemeColorName };

/** 4px grid. Prefer these over raw numbers in new screens. */
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Brand radius is 10px (client web `--radius`). */
export const Radius = {
  sm: 5,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const FontFamily = {
  regular: "BarlowRegular",
  medium: "BarlowMedium",
  light: "BarlowLight",
} as const;

type TypeStyle = Pick<
  TextStyle,
  "fontFamily" | "fontSize" | "lineHeight" | "letterSpacing"
>;

/** Type scale — Medium for titles/buttons, Regular for body. */
export const Type: Record<
  "display" | "title" | "subtitle" | "body" | "caption" | "label" | "button",
  TypeStyle
> = {
  display: {
    fontFamily: FontFamily.medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  button: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },
};

/** Primary control height — usable with wet/gloved hands. */
export const TapTarget = {
  min: 44,
  button: 52,
  dock: 56,
} as const;

/** Bottom tab dock (Today / Schedule / Me). */
export const Dock = {
  height: 56,
  iconSize: 22,
} as const;

export const StatusTone = {
  pending: "warning",
  accepted: "primary",
  in_progress: "success",
  completed: "success",
  cancelled: "error",
} as const;

export type JobStatusTone = keyof typeof StatusTone;
