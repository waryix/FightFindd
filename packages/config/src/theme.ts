/**
 * FightFind design tokens — single source of truth for the dark combat-sports
 * aesthetic shared by the mobile app and the gym owner portal.
 */
export const colors = {
  /** Primary FightFind accent (red). */
  primary: "#E63946",
  primaryDark: "#B32C38",
  primarySoft: "rgba(230, 57, 70, 0.14)",
  primaryBorder: "rgba(230, 57, 70, 0.4)",

  background: "#0A0A0A",
  surface: "#141414",
  surfaceRaised: "#1A1A1A",
  border: "#2A2A2A",
  borderSubtle: "#1F1F1F",

  textPrimary: "#FFFFFF",
  textSecondary: "#888888",
  textMuted: "#555555",
  textFaint: "#444444",

  success: "#22C55E",
  successSoft: "rgba(34, 197, 94, 0.14)",
  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.14)",
  info: "#3B82F6",
  infoSoft: "rgba(59, 130, 246, 0.14)",
  danger: "#E63946",
  dangerSoft: "rgba(230, 57, 70, 0.14)",
  neutral: "#666666",
  neutralSoft: "rgba(102, 102, 102, 0.14)",

  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0, 0, 0, 0.65)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

export const typography = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    display: 32,
    hero: 48,
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "900",
  },
} as const;

export const disciplineColors: Record<string, string> = {
  boxing: "#3B82F6",
  mma: "#E63946",
  muay_thai: "#F59E0B",
  kickboxing: "#8B5CF6",
  bjj: "#22C55E",
  wrestling: "#F97316",
  mixed: "#EC4899",
};

export const skillColors: Record<string, string> = {
  beginner: "#22C55E",
  intermediate: "#3B82F6",
  advanced: "#F59E0B",
  professional: "#E63946",
};

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const statusTones: Record<StatusTone, { color: string; soft: string }> = {
  success: { color: colors.success, soft: colors.successSoft },
  warning: { color: colors.warning, soft: colors.warningSoft },
  danger: { color: colors.danger, soft: colors.dangerSoft },
  info: { color: colors.info, soft: colors.infoSoft },
  neutral: { color: colors.neutral, soft: colors.neutralSoft },
};

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  disciplineColors,
  skillColors,
  statusTones,
} as const;

export type Theme = typeof theme;
