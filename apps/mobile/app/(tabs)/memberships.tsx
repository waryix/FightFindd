import { FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionLabel, StatusBadge, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";

export default function MembershipsScreen() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["my-memberships"],
    queryFn: () => api.fighters.memberships(),
  });

  if (query.isPending) return <LoadingState message="Loading memberships…" />;
  if (query.isError) {
    return <ErrorState message="Couldn't load memberships" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const memberships = query.data.items;

  if (memberships.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No gym memberships yet"
          message="Find a gym near you and join with a secure Razorpay payment."
          actionTitle="Browse gyms"
          onAction={() => router.push("/(tabs)/gyms")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={memberships}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <AppText variant="subheading">{item.gym.name}</AppText>
            <AppText variant="caption">{item.gym.city}</AppText>
            <SectionLabel style={styles.sectionLabel}>Membership</SectionLabel>
            <StatusBadge status={item.status} />
            {item.status === "paid_pending_approval" ? (
              <AppText variant="caption" color={theme.colors.warning}>
                Waiting for gym approval. The gym has been notified.
              </AppText>
            ) : null}
            {item.status === "rejected" ? (
              <AppText variant="caption" color={theme.colors.danger}>
                The gym declined this request. The payment will be refunded.
              </AppText>
            ) : null}
            <SectionLabel style={styles.sectionLabel}>Payment</SectionLabel>
            <AppText variant="bodyStrong">{formatPaise(item.amountPaise)}</AppText>
            {item.expiresAt ? (
              <AppText variant="caption">
                Renews around {new Date(item.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </AppText>
            ) : null}
            <Button
              title="View gym"
              variant="secondary"
              size="sm"
              onPress={() => router.push({ pathname: "/(tabs)/gym/[gymId]", params: { gymId: item.gym.id } })}
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { gap: 6 },
  sectionLabel: { marginTop: 8 },
});
