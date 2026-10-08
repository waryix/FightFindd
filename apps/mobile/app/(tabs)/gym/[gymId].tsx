import { Linking, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, ErrorState, InfoGrid, LoadingState, ScreenScroll, SectionLabel, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { formatDistance, formatPaise } from "@fightfind/utils";
import { api } from "../../../src/api/client";
import { errorMessage } from "../../../src/api/errors";
import { useAuth } from "../../../src/auth/auth-context";
import { useRequireAccount } from "../../../src/auth/use-require-account";

export default function GymDetailScreen() {
  const router = useRouter();
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const { status } = useAuth();
  const requireAccount = useRequireAccount();

  const query = useQuery({
    queryKey: ["gym", gymId],
    queryFn: () => api.gyms.get(gymId!, {}),
    enabled: Boolean(gymId),
  });

  const membershipQuery = useQuery({
    queryKey: ["gym-membership", gymId, status],
    queryFn: () => api.gyms.myMembership(gymId!),
    enabled: Boolean(gymId) && status === "authenticated",
  });

  if (query.isPending) return <LoadingState message="Loading gym…" />;
  if (query.isError) {
    return <ErrorState message="Couldn't load this gym" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const gym = query.data.gym;
  const membership = membershipQuery.data?.membership ?? null;

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <AppText variant="heading" style={styles.name}>
            {gym.name}
          </AppText>
          {gym.isVerified ? <Badge label="Verified" tone="success" /> : null}
        </View>
        <AppText variant="caption">
          {gym.address}, {gym.city}, {gym.state}
          {gym.distanceKm !== null ? ` · ${formatDistance(gym.distanceKm)} away` : ""}
        </AppText>
      </View>

      <Card style={styles.priceCard}>
        <AppText variant="caption" color={theme.colors.textMuted}>
          MONTHLY MEMBERSHIP
        </AppText>
        <AppText variant="heading" color={theme.colors.primary}>
          {gym.monthlyFeePaise ? `${formatPaise(gym.monthlyFeePaise)} / month` : "Contact gym for pricing"}
        </AppText>
        {gym.hasTrialClass ? <Badge label="Free trial class" tone="success" /> : null}
      </Card>

      <View>
        <SectionLabel>Disciplines</SectionLabel>
        <View style={styles.chips}>
          {gym.disciplines.map((discipline) => (
            <Card key={discipline} padded={false} style={styles.chip}>
              <AppText variant="caption" style={styles.chipText}>
                {discipline.replace(/_/g, " ")}
              </AppText>
            </Card>
          ))}
        </View>
      </View>

      <InfoGrid
        items={[
          { label: "Timings", value: gym.timings },
          { label: "Phone", value: gym.phone },
          { label: "Pincode", value: gym.pincode },
          { label: "Owner", value: gym.ownerName },
        ]}
      />

      {gym.description ? (
        <View>
          <SectionLabel>About</SectionLabel>
          <AppText variant="body" color={theme.colors.textSecondary} style={styles.description}>
            {gym.description}
          </AppText>
        </View>
      ) : null}

      {gym.latitude && gym.longitude ? (
        <Button
          title="Open in Maps"
          variant="secondary"
          onPress={() =>
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${gym.latitude},${gym.longitude}`)
          }
        />
      ) : null}

      {membership && membership.status !== "rejected" && membership.status !== "payment_failed" ? (
        <Card style={styles.membershipCard}>
          <AppText variant="bodyStrong">Your membership</AppText>
          <AppText variant="caption" style={styles.membershipText}>
            Status: {membership.status.replace(/_/g, " ")}
            {membership.status === "paid_pending_approval" ? " — waiting for gym approval" : ""}
          </AppText>
          <Button title="View Memberships" variant="secondary" size="sm" onPress={() => router.push("/(tabs)/memberships")} />
        </Card>
      ) : (
        <View style={styles.ctaGroup}>
          <Button
            title={gym.monthlyFeePaise ? `Join Gym · ${formatPaise(gym.monthlyFeePaise)} / month` : "Join Gym"}
            size="lg"
            disabled={!gym.monthlyFeePaise}
            onPress={() =>
              requireAccount(
                () => router.push({ pathname: "/(tabs)/checkout/[gymId]", params: { gymId: gym.id } }),
                "Create a free Fighter account to join a gym.",
              )
            }
          />
          {gym.hasTrialClass ? (
            <Button
              title="Start Free Trial"
              variant="secondary"
              onPress={() =>
                requireAccount(
                  () => router.push({ pathname: "/(tabs)/checkout/[gymId]", params: { gymId: gym.id } }),
                  "Create a free Fighter account to start a trial.",
                )
              }
            />
          ) : null}
        </View>
      )}

      {gym.phone ? (
        <Button title="Call Gym" variant="ghost" onPress={() => Linking.openURL(`tel:${gym.phone}`)} />
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  nameRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  name: { flexShrink: 1 },
  priceCard: { gap: 6, borderColor: theme.colors.primaryBorder },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.md, borderColor: theme.colors.border },
  chipText: { textTransform: "capitalize" },
  description: { lineHeight: 22 },
  membershipCard: { gap: 8 },
  membershipText: { textTransform: "capitalize" },
  ctaGroup: { gap: 10 },
});
