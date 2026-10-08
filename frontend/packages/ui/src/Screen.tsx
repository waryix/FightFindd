import { ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { theme } from "@fightfind/config";
import { AppText } from "./primitives.js";

export function Screen({ children, style, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[styles.screen, style]}>
      {children}
    </View>
  );
}

export function ScreenScroll({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: ViewProps["style"];
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: ViewProps["style"] }) {
  return (
    <AppText variant="label" style={[styles.section, style]}>
      {children}
    </AppText>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { padding: 20, paddingBottom: 64, gap: 16 },
  section: { marginTop: 8 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: { gap: 2, flex: 1 },
});
