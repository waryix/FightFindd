import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, StyleSheet } from "react-native";
import { Avatar, Badge, Button, Card, ErrorState, InfoGrid, LoadingState, ScreenScroll, SectionLabel, StatGrid, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { formatDistance } from "@fightfind/utils";
import { api } from "../../../src/api/client";
import { errorMessage } from "../../../src/api/errors";
import { useAuth } from "../../../src/auth/auth-context";
import { useRequireAccount } from "../../../src/auth/use-require-account";

export default function FighterDetailScreen() {
  const router = useRouter();
  const { fighterId } = useLocalSearchParams<{ fighterId: string }>();
  const { user, isPremium } = useAuth();
  const requireAccount = useRequireAccount();

  const query = useQuery({
    queryKey: ["fighter", fighterId],
    queryFn: async () => {
      const stored = await getStoredCoords();
      return api.fighters.get(fighterId!, stored);
    },
    enabled: Boolean(fighterId),
  });

  if (query.isPending) return <LoadingState message="Loading fighter…" />;
  if (query.isError) {
    return <ErrorState message="Couldn't load this fighter" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const fighter = query.data.fighter;
  const isOwnProfile = user?.id === fighter.userId;
  const skillColor = theme.colors.primary;

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Avatar name={fighter.name} avatarUrl={fighter.avatarUrl} size={96} />
        <View style={styles.nameRow}>
          <AppText variant="heading">{fighter.name}</AppText>
          {fighter.verificationStatus === "verified" ? <Badge label="Verified" tone="success" /> : null}
          {fighter.premiumStatus ? <Badge label="Pro" tone="info" /> : null}
        </View>
        <AppText variant="caption">
          {fighter.city}, {fighter.state}
          {fighter.distanceKm !== null ? ` · ${formatDistance(fighter.distanceKm)} away` : ""}
        </AppText>
        <View style={styles.badges}>
          <View style={[styles.skillBadge, { borderColor: skillColor, backgroundColor: skillColor + "22" }]}>
            <AppText variant="caption" color={skillColor} style={styles.skillText}>
              {fighter.skillLevel}
            </AppText>
          </View>
          <Badge label={fighter.weightClass.replace(/_/g, " ")} tone="neutral" />
          {fighter.compatibilityScore !== null ? (
            <Badge label={`${fighter.compatibilityScore}% match`} tone="success" />
          ) : null}
        </View>
      </View>

      <StatGrid
        items={[
          { value: fighter.yearsExperience, label: "Years Training" },
          { value: fighter.totalAmateurFights, label: "Amateur Fights" },
          { value: fighter.totalProFights, label: "Pro Fights" },
        ]}
      />

      <InfoGrid
        items={[
          { label: "Height", value: fighter.heightCm ? `${fighter.heightCm} cm` : null },
          { label: "Weight", value: fighter.weightKg ? `${fighter.weightKg} kg` : null },
          { label: "Age", value: fighter.ageYears ? `${fighter.ageYears} yrs` : null },
          { label: "Gym", value: fighter.gymName },
        ]}
      />

      <View>
        <SectionLabel>Disciplines</SectionLabel>
        <View style={styles.chips}>
          {fighter.disciplines.map((discipline) => (
            <Card key={discipline} padded={false} style={styles.chip}>
              <AppText variant="caption" style={styles.chipText}>
                {discipline.replace(/_/g, " ")}
              </AppText>
            </Card>
          ))}
        </View>
      </View>

      {fighter.bio ? (
        <View>
          <SectionLabel>About</SectionLabel>
          <AppText variant="body" color={theme.colors.textSecondary} style={styles.bio}>
            {fighter.bio}
          </AppText>
        </View>
      ) : null}

      {isOwnProfile ? (
        <Button title="Edit Profile" variant="secondary" size="lg" onPress={() => router.push("/(tabs)/edit-profile")} />
      ) : (
        <Button
          title="Request Sparring"
          size="lg"
          onPress={() =>
            requireAccount(
              () =>
                router.push({
                  pathname: "/(tabs)/request/[receiverId]",
                  params: {
                    receiverId: fighter.id,
                    receiverName: fighter.name,
                    receiverSkill: fighter.skillLevel,
                    receiverDisciplines: JSON.stringify(fighter.disciplines),
                  },
                }),
              "Create a free Fighter account to send sparring requests.",
            )
          }
        />
      )}

      {!isOwnProfile ? (
        <Button
          title="Report profile"
          variant="ghost"
          size="sm"
          onPress={() =>
            requireAccount(async () => {
              await api.fighters.report({ userId: fighter.userId, reason: "other", details: "Reported from profile" });
            })
          }
        />
      ) : null}

      {!isPremium && !isOwnProfile ? (
        <AppText variant="caption" color={theme.colors.textMuted} center>
          Free accounts can hold a limited number of pending requests.
        </AppText>
      ) : null}
    </ScreenScroll>
  );
}

async function getStoredCoords(): Promise<{ lat?: number; lng?: number }> {
  // Location is requested in Discover; profile views reuse whatever was last
  // granted without prompting again.
  try {
    const Location = await import("expo-location");
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return {};
    const last = await Location.getLastKnownPositionAsync();
    if (!last) return {};
    return { lat: last.coords.latitude, lng: last.coords.longitude };
  } catch {
    return {};
  }
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: 8, paddingVertical: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  badges: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  skillBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1 },
  skillText: { fontWeight: "700", textTransform: "capitalize" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.md, borderColor: theme.colors.border },
  chipText: { textTransform: "capitalize" },
  bio: { lineHeight: 22 },
});
