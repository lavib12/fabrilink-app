import { useColorScheme } from "react-native";

/**
 * FabriLink palette — drawn from the mill floor rather than a SaaS kit:
 *   greige   unbleached "greige goods" cloth, the app's ground
 *   loom ink the deep blue-black of indigo-dyed yarn, used for text
 *   teal     bottle-green dye-house teal, the action colour
 *   jute     the golden fibre of Bengal, reserved for exclusive profiles
 *   madder   the madder-root red, reserved for errors and destructive actions
 */
const brand = {
  greige: "#EEF0EA",
  greigeDeep: "#E2E6DD",
  loomInk: "#17262B",
  slate: "#5B6B6E",
  teal: "#0B6E69",
  tealSoft: "#DCEDEA",
  jute: "#B8860B",
  juteSoft: "#F6ECD2",
  madder: "#A63A2B",
  madderSoft: "#F6E1DC",
  leaf: "#2F7D46",
  leafSoft: "#DFEFE3",
  turmeric: "#B26B00",
  turmericSoft: "#F8E8CC",
  river: "#2B6A8F",
  riverSoft: "#DDEAF2",
};

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  exclusive: string;
  exclusiveSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  /** Tape-measure yellow for the yard ruler. */
  tape: string;
  tapeInk: string;
}

const light: ThemeColors = {
  background: brand.greige,
  surface: "#FFFFFF",
  surfaceMuted: brand.greigeDeep,
  border: "#D3D8CF",
  text: brand.loomInk,
  textMuted: brand.slate,
  primary: brand.teal,
  primaryText: "#FFFFFF",
  primarySoft: brand.tealSoft,
  exclusive: brand.jute,
  exclusiveSoft: brand.juteSoft,
  success: brand.leaf,
  successSoft: brand.leafSoft,
  warning: brand.turmeric,
  warningSoft: brand.turmericSoft,
  danger: brand.madder,
  dangerSoft: brand.madderSoft,
  info: brand.river,
  infoSoft: brand.riverSoft,
  tape: "#F2C94C",
  tapeInk: "#3A2E05",
};

const dark: ThemeColors = {
  background: "#0E1719",
  surface: "#172427",
  surfaceMuted: "#1F3034",
  border: "#2C3E42",
  text: "#E6ECE8",
  textMuted: "#9AABAA",
  primary: "#4FC1B8",
  primaryText: "#06201E",
  primarySoft: "#123A38",
  exclusive: "#E0B44C",
  exclusiveSoft: "#3A2E10",
  success: "#6CC28A",
  successSoft: "#15301F",
  warning: "#E8A33D",
  warningSoft: "#3A2709",
  danger: "#E2735F",
  dangerSoft: "#3D1712",
  info: "#78B4DA",
  infoSoft: "#11293A",
  tape: "#E2B93B",
  tapeInk: "#2A2104",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Radius follows hierarchy: sheets > cards > inputs/buttons; chips are pills. */
export const radius = { sm: 6, md: 10, lg: 14, sheet: 22, pill: 999 } as const;

/** Modular scale (~1.25) for a phone reading distance. */
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 19, xl: 24, xxl: 31 } as const;

/**
 * Hind Siliguri was drawn for Bangla and ships a matching Latin, so both languages share
 * one voice. React Native needs a family per weight (fontWeight alone doesn't switch faces).
 */
export const fonts = {
  regular: "HindSiliguri_400Regular",
  medium: "HindSiliguri_500Medium",
  semibold: "HindSiliguri_600SemiBold",
  bold: "HindSiliguri_700Bold",
} as const;

export type FontWeightKey = keyof typeof fonts;

/** Minimum touch target (Apple HIG / Material). */
export const MIN_TOUCH = 44;

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { dark: isDark, colors: isDark ? dark : light };
}
