import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, Screen, ScreenHeader, SegmentedTabs, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import type { SparringRequestStatus } from "@fightfind/types";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";
import { MatchCard } from "../../src/components/MatchCard";
import { useAuth } from "../../src/auth/auth-context";

export default function MatchesScreen() {
  const router = useRouter();
  const { user, isGuest, status } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"received" | "sent">("received");

  const query = useQuery({
    queryKey: ["matches", tab],
    queryFn: () => api.matches.list({ tab, limit: 50 }),
    enabled: status === "authenticated",
    staleTime: 0,
    refetchOnMount: "always",
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SparringRequestStatus }) =>
      api.matches.updateStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  const matches = query.data?.items ?? [];

  if (isGuest || status === "signed_out") {
    return (
      <Screen>
        <ScreenHeader title="Matches" subtitle="Your sparring requests" />
        <EmptyState
          title="Create an account to see matches"
          message="Sparring requests and chats are available once you have a free Fighter account."
          actionTitle="Create free account"
          onAction={() => router.push("/(auth)/signup")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Matches" subtitle="Your sparring requests" />
      <View style={styles.tabs}>
        <SegmentedTabs
          tabs={[
            { key: "received", label: `Received${matches.length && tab === "received" ? ` (${matches.length})` : ""}` },
            { key: "sent", label: `Sent${matches.length && tab === "sent" ? ` (${matches.length})` : ""}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {query.isPending ? (
        <LoadingState message="Loading matches…" />
      ) : query.isError ? (
        <ErrorState message="Couldn't load matches" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : matches.length === 0 ? (
        <EmptyState
          title={tab === "received" ? "No requests received yet" : "No requests sent yet"}
          message={
            tab === "received"
              ? "When fighters request to spar with you, they'll appear here."
              : "Go to Discover and send your first sparring request."
          }
          actionTitle={tab === "sent" ? "Find fighters" : undefined}
          onAction={tab === "sent" ? () => router.push("/(tabs)/discover") : undefined}
        />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const other = tab === "received" ? item.sender : item.receiver;
            return (
              <MatchCard
                match={item}
                tab={tab}
                myUserId={user?.id ?? ""}
                busy={mutation.isPending}
                onOpenProfile={() =>
                  other && router.push({ pathname: "/(tabs)/fighter/[fighterId]", params: { fighterId: other.id } })
                }
                onOpenChat={() =>
                  router.push({
                    pathname: "/(tabs)/chat/[matchId]",
                    params: {
                      matchId: item.id,
                      otherName: other?.name ?? "Fighter",
                      otherUserId: other?.userId ?? "",
                    },
                  })
                }
                onStatusChange={(status) => mutation.mutate({ id: item.id, status })}
              />
            );
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListFooterComponent={
            mutation.isError ? (
              <AppText variant="caption" center color={theme.colors.danger} style={styles.footer}>
                {errorMessage(mutation.error)}
              </AppText>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 16, paddingBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  footer: { paddingVertical: 12 },
});
