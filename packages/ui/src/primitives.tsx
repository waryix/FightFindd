import { StyleSheet, Text, type TextProps } from "react-native";
import { theme } from "@fightfind/config";

type Variant = "hero" | "title" | "heading" | "subheading" | "body" | "bodyStrong" | "label" | "caption";

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

export function AppText({ variant = "body", color, center, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[styles.base, styles[variant], color ? { color } : null, center ? styles.center : null, style]} />;
}

export const Heading = (props: AppTextProps) => <AppText variant="heading" {...props} />;
export const Title = (props: AppTextProps) => <AppText variant="title" {...props} />;
export const Subheading = (props: AppTextProps) => <AppText variant="subheading" {...props} />;
export const Body = (props: AppTextProps) => <AppText variant="body" {...props} />;
export const Label = (props: AppTextProps) => <AppText variant="label" {...props} />;
export const Caption = (props: AppTextProps) => <AppText variant="caption" {...props} />;

const styles = StyleSheet.create({
  base: { color: theme.colors.textPrimary },
  hero: { fontSize: theme.typography.sizes.hero, fontWeight: "900", letterSpacing: -1 },
  title: { fontSize: theme.typography.sizes.display, fontWeight: "800", lineHeight: 38 },
  heading: { fontSize: theme.typography.sizes.xxl, fontWeight: "800" },
  subheading: { fontSize: theme.typography.sizes.lg, fontWeight: "700" },
  body: { fontSize: theme.typography.sizes.md, lineHeight: 21 },
  bodyStrong: { fontSize: theme.typography.sizes.md, fontWeight: "600" },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  caption: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  center: { textAlign: "center" },
});
