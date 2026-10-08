import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Badge, Button, Card, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { formatDistance, formatPaise } from "@fightfind/utils";
import type { GymCard as GymCardData } from "@fightfind/types";

interface Props {
  gym: GymCardData;
  onPress: () => void;
}

export function GymCard({ gym, onPress }: Props) {
  const initials = gym.name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card padded={false} style={styles.card}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`View ${gym.name}`}
      >
        {gym.coverPhotoUrl ? (
          <Image source={{ uri: gym.coverPhotoUrl }} style={styles.cover} />
        ) : (
          <View style={styles.coverFallback}>
            <AppText variant="heading" color={theme.colors.primary}>
              {initials}
            </AppText>
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText variant="subheading" numberOfLines={1} style={styles.name}>
              {gym.name}
            </AppText>
            {gym.isVerified ? <Badge label="Verified" tone="success" /> : null}
          </View>
          <AppText variant="caption">
            {gym.city}
            {gym.distanceKm !== null ? ` · ${formatDistance(gym.distanceKm)} away` : ""}
          </AppText>

          <View style={styles.disciplines}>
            {gym.disciplines.map((discipline) => (
              <View key={discipline} style={styles.disciplineChip}>
                <AppText variant="caption" style={styles.disciplineText}>
                  {discipline.replace(/_/g, " ")}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.metaRow}>
            <View>
              <AppText variant="caption" color={theme.colors.textMuted}>
                MONTHLY
              </AppText>
              <AppText variant="bodyStrong">
                {gym.monthlyFeePaise ? `${formatPaise(gym.monthlyFeePaise)} / mo` : "Contact gym"}
              </AppText>
            </View>
            <View style={styles.metaRight}>
              {gym.hasTrialClass ? <Badge label="Free trial" tone="success" /> : null}
            </View>
          </View>

          {gym.description ? (
            <AppText variant="caption" numberOfLines={2} style={styles.description}>
              {gym.description}
            </AppText>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Button title="View Gym" variant="secondary" size="sm" style={styles.button} onPress={onPress} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden" },
  cover: { width: "100%", height: 132 },
  coverFallback: {
    width: "100%",
    height: 104,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 14, gap: 5 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1 },
  disciplines: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  disciplineChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: theme.colors.surfaceRaised },
  disciplineText: { color: theme.colors.textSecondary, textTransform: "capitalize" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  metaRight: { flexDirection: "row", gap: 6 },
  description: { lineHeight: 18 },
  footer: { paddingHorizontal: 14, paddingBottom: 14 },
  button: { alignSelf: "stretch" },
});
