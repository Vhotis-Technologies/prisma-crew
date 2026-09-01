/**
 * Prisma Crew colour tokens — aligned with client web (`prisma_web` :root).
 *
 * Primary (#0074d4) = info, links, selected state.
 * Button (#6A0DAD) = main actions only (Start, Complete, Save).
 * Canvas (#F1F1F1) = screen background; cards stay elevated white.
 */

const light = {
  background: "#F1F1F1",
  canvas: "#F1F1F1",
  cards: "#FFFFFF",
  borders: "#E5E5E5",
  icons: "#424242",
  text: "#212121",
  muted: "#424242",
  button: "#6A0DAD",
  buttonHover: "#570B8C",
  secondaryButton: "#0074D4",
  primary: "#0074D4",
  primaryHover: "#005FAD",
  primarySoft: "#E6F3FB",
  buttonText: "#FFFFFF",
  error: "#D32F2F",
  errorBg: "#FDECEA",
  tint: "#0074D4",
  success: "#4CAF50",
  successBg: "#E8F5E9",
  warning: "#FF9800",
  warningBg: "#FFF3E0",
  panel: "#121212",
  panelMuted: "#BDBDBD",
};

const dark = {
  background: "#121212",
  canvas: "#121212",
  cards: "#1E1E1E",
  borders: "#333333",
  icons: "#BDBDBD",
  text: "#FFFFFF",
  muted: "#BDBDBD",
  button: "#6A0DAD",
  buttonHover: "#8B3DCC",
  secondaryButton: "#0074D4",
  primary: "#4DA3E6",
  primaryHover: "#0074D4",
  primarySoft: "#0D2A40",
  buttonText: "#FFFFFF",
  error: "#F44336",
  errorBg: "#3D1515",
  tint: "#4DA3E6",
  success: "#4CAF50",
  successBg: "#14301A",
  warning: "#FF9800",
  warningBg: "#3D2A10",
  panel: "#000000",
  panelMuted: "#BDBDBD",
};

/** Theme colour map keyed by `light` and `dark`. */
export const Colors = {
  light,
  dark,
};

export type ThemeColorName = keyof typeof light;
