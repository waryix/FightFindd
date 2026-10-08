import { StyleSheet, View } from "react-native";
import { Avatar, Button, Card, StatusBadge, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import type { SparringRequest } from "@fightfind/types";

interface Props {
  match: SparringRequest;
  tab: "received" | "sent";
  myUserId: string;
  busy?: boolean;
  onOpenProfile: () => void;
  onOpenChat: () => void;
  onStatusChange: (status: "accepted" | "declined" | "completed" | "cancelled") => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MatchCard({ match, tab, busy, onOpenProfile, onOpenChat, onStatusChange }: Props) {
  const other = tab === "received" ? match.sender : match.receiver;
  return (
    <Card>
      <View style={styles.top}>
        <Avatar name={other?.name ?? "Fighter"} avatarUrl={other?.avatarUrl} size={46} />
        <View style={styles.info}>
          <AppText variant="subheading" numberOfLines={1}>
            {other?.name ?? "Unknown Fighter"}
          </AppText>
          <AppText variant="caption" color={theme.colors.primary} style={styles.discipline}>
            {match.discipline.replace(/_/g, " ")}
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {formatDateTime(match.proposedDate)}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {match.proposedLocation}
          </AppText>
        </View>
        <StatusBadge status={match.status} />
      </View>

      {other ? (
        <View style={styles.meta}>
          <AppText variant="caption" style={styles.metaText}>
            {other.skillLevel} · {other.weightClass.replace(/_/g, " ")} · {other.city}
          </AppText>
        </View>
      ) : null}

      {match.message ? (
        <AppText variant="caption" style={styles.message}>
          "{match.message}"
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {tab === "received" && match.status === "pending" ? (
          <>
            <Button title="Decline" variant="secondary" size="sm" disabled={busy} onPress={() => onStatusChange("declined")} style={styles.action} />
            <Button title="Accept" variant="success" size="sm" disabled={busy} onPress={() => onStatusChange("accepted")} style={styles.action} />
          </>
        ) : null}
        {tab === "sent" && match.status === "pending" ? (
          <Button title="Cancel Request" variant="secondary" size="sm" disabled={busy} onPress={() => onStatusChange("cancelled")} style={styles.action} />
        ) : null}
        {match.status === "accepted" ? (
          <>
            <Button title="Chat" variant="secondary" size="sm" onPress={onOpenChat} style={styles.action} />
            <Button title="Mark Completed" size="sm" disabled={busy} onPress={() => onStatusChange("completed")} style={styles.action} />
          </>
        ) : null}
        {match.status === "completed" ? (
          <Button title="Chat" variant="secondary" size="sm" onPress={onOpenChat} style={styles.action} />
        ) : null}
        <Button title="Profile" variant="ghost" size="sm" onPress={onOpenProfile} style={styles.actionSmall} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  info: { flex: 1, gap: 2 },
  discipline: { fontWeight: "700", textTransform: "capitalize" },
  meta: { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radii.sm, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  metaText: { color: theme.colors.textSecondary, textTransform: "capitalize" },
  message: { marginTop: 10, fontStyle: "italic", lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  action: { flex: 1 },
  actionSmall: { paddingHorizontal: 8 },
});
