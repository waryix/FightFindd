import { StyleSheet, View } from "react-native";
import { theme } from "@fightfind/config";
import { AppText } from "./primitives.js";

export function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statCard}>
      <AppText variant="heading" color={theme.colors.primary} style={styles.statValue}>
        {String(value)}
      </AppText>
      <AppText variant="caption" color={theme.colors.textMuted} center>
        {label}
      </AppText>
    </View>
  );
}

export function StatGrid({ items }: { items: { value: string | number; label: string }[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <StatCard key={item.label} value={item.value} label={item.label} />
      ))}
    </View>
  );
}

export function InfoGrid({ items }: { items: { label: string; value: string | null | undefined }[] }) {
  const visible = items.filter((item) => item.value != null && item.value !== "");
  if (visible.length === 0) return null;
  return (
    <View style={styles.grid}>
      {visible.map((item) => (
        <View key={item.label} style={styles.infoItem}>
          <AppText variant="caption" color={theme.colors.textMuted} style={styles.infoLabel}>
            {item.label}
          </AppText>
          <AppText variant="bodyStrong" style={styles.infoValue}>
            {item.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flex: 1,
    minWidth: "28%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 22, marginBottom: 2 },
  infoItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  infoLabel: { textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11, marginBottom: 4 },
  infoValue: { textTransform: "capitalize" },
});
