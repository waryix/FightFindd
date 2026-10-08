import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@fightfind/config";

interface SegmentedTabsProps<T extends string> {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}

export function SegmentedTabs<T extends string>({ tabs, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.lg,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: theme.radii.md, minHeight: 40 },
  tabActive: { backgroundColor: theme.colors.primary },
  label: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary },
  labelActive: { color: "#fff" },
});
