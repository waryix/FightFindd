import { FlatList, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { timeAgo } from "@fightfind/utils";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list({ limit: 50 }),
  });

  const markAll = async () => {
    await api.notifications.markRead({ all: true });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (query.isPending) return <LoadingState message="Loading notifications…" />;
  if (query.isError) {
    return <ErrorState message="Couldn't load notifications" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const items = query.data.items;

  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState title="You're all caught up" message="Sparring requests, messages and payment updates will appear here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          items.some((item) => !item.readAt) ? (
            <Button title="Mark all as read" variant="secondary" size="sm" onPress={markAll} style={styles.markAll} />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={[styles.card, !item.readAt ? styles.unread : null]}>
            <AppText variant="bodyStrong">{item.title}</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary} style={styles.body}>
              {item.body}
            </AppText>
            <AppText variant="caption" color={theme.colors.textFaint}>
              {timeAgo(item.createdAt)}
            </AppText>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  markAll: { marginBottom: 6, alignSelf: "flex-start" },
  card: { gap: 4 },
  unread: { borderColor: theme.colors.primaryBorder },
  body: { lineHeight: 18 },
});
