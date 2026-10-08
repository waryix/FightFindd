import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Badge, Button, Card, AppText } from "@fightfind/ui";
import { theme, skillColors } from "@fightfind/config";
import { formatDistance } from "@fightfind/utils";
import type { FighterCard as FighterCardData } from "@fightfind/types";

interface Props {
  fighter: FighterCardData;
  onPress: () => void;
  onRequest?: () => void;
}

export function FighterCard({ fighter, onPress, onRequest }: Props) {
  const skillColor = skillColors[fighter.skillLevel] ?? theme.colors.textSecondary;
  return (
    <Card>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`View ${fighter.name}'s profile`}>
        <View style={styles.top}>
          <Avatar name={fighter.name} avatarUrl={fighter.avatarUrl} size={54} />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <AppText variant="subheading" numberOfLines={1} style={styles.name}>
                {fighter.name}
              </AppText>
              {fighter.verificationStatus === "verified" ? <Badge label="Verified" tone="success" /> : null}
              {fighter.premiumStatus ? <Badge label="Pro" tone="info" /> : null}
            </View>
            <AppText variant="caption">
              {fighter.city}
              {fighter.distanceKm !== null ? ` · ${formatDistance(fighter.distanceKm)} away` : ""}
            </AppText>
            <View style={styles.tags}>
              <View style={[styles.skillTag, { borderColor: skillColor, backgroundColor: skillColor + "22" }]}>
                <AppText variant="caption" color={skillColor} style={styles.skillText}>
                  {fighter.skillLevel}
                </AppText>
              </View>
              <View style={styles.tag}>
                <AppText variant="caption" style={styles.tagText}>
                  {fighter.weightClass}
                </AppText>
              </View>
              {fighter.weightKg ? (
                <View style={styles.tag}>
                  <AppText variant="caption" style={styles.tagText}>
                    {fighter.weightKg} kg
                  </AppText>
                </View>
              ) : null}
              {fighter.heightCm ? (
                <View style={styles.tag}>
                  <AppText variant="caption" style={styles.tagText}>
                    {fighter.heightCm} cm
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
          {fighter.compatibilityScore !== null ? (
            <View style={styles.matchBadge}>
              <AppText variant="bodyStrong" color={theme.colors.success}>
                {fighter.compatibilityScore}%
              </AppText>
              <AppText variant="caption" color={theme.colors.textMuted} style={styles.matchLabel}>
                match
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.stats}>
          {[
            { value: fighter.yearsExperience, label: "yrs exp" },
            { value: fighter.totalAmateurFights, label: "amateur" },
            { value: fighter.totalProFights, label: "pro" },
          ].map((stat, index) => (
            <View key={stat.label} style={styles.statWrap}>
              {index > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.stat}>
                <AppText variant="subheading">{stat.value}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {stat.label}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.disciplines}>
          {fighter.disciplines.map((discipline) => (
            <View key={discipline} style={styles.disciplineChip}>
              <AppText variant="caption" style={styles.disciplineText}>
                {discipline.replace(/_/g, " ")}
              </AppText>
            </View>
          ))}
        </View>

        {fighter.bio ? (
          <AppText variant="caption" numberOfLines={2} style={styles.bio}>
            {fighter.bio}
          </AppText>
        ) : null}
      </TouchableOpacity>

      {onRequest ? (
        <View style={styles.footer}>
          <Button title="View profile" variant="secondary" size="sm" fullWidth={false} onPress={onPress} style={styles.viewButton} />
          <Button title="Request Sparring" size="sm" fullWidth={false} onPress={onRequest} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: 12 },
  info: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { flexShrink: 1 },
  tags: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
  skillTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  skillText: { fontWeight: "700", textTransform: "capitalize" },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.border },
  tagText: { color: theme.colors.textSecondary, textTransform: "capitalize" },
  matchBadge: { alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  matchLabel: { fontSize: 10 },
  stats: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.md,
    paddingVertical: 8,
    marginTop: 12,
    alignItems: "center",
  },
  statWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  statDivider: { width: 1, height: 24, backgroundColor: theme.colors.border, marginHorizontal: 8 },
  stat: { flex: 1, alignItems: "center" },
  disciplines: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  disciplineChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.colors.surfaceRaised },
  disciplineText: { color: theme.colors.textSecondary, textTransform: "capitalize" },
  bio: { marginTop: 10, lineHeight: 18 },
  footer: { flexDirection: "row", gap: 10, marginTop: 14 },
  viewButton: { flex: 1 },
});
