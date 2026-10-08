import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { theme } from "@fightfind/config";
import { AppText } from "./primitives.js";
import { Button } from "./Button.js";

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <AppText variant="caption">{message}</AppText>
    </View>
  );
}

export function ErrorState({
  message = "Something went wrong",
  detail,
  onRetry,
}: {
  message?: string;
  detail?: string | null;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <AppText variant="subheading" center>
        {message}
      </AppText>
      {detail ? (
        <AppText variant="caption" color={theme.colors.textMuted} center>
          {detail}
        </AppText>
      ) : null}
      {onRetry ? (
        <Button title="Retry" variant="secondary" size="sm" fullWidth={false} onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionTitle,
  onAction,
}: {
  title: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <AppText variant="subheading" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" center>
          {message}
        </AppText>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} variant="secondary" size="sm" fullWidth={false} onPress={onAction} />
      ) : null}
    </View>
  );
}

export function InlineBanner({
  tone = "info",
  message,
  actionTitle,
  onAction,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const palette = theme.statusTones[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.soft, borderColor: palette.color + "55" }]}>
      <AppText variant="caption" color={palette.color} style={styles.bannerText}>
        {message}
      </AppText>
      {actionTitle && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionTitle}>
          <AppText variant="caption" color={palette.color} style={styles.bannerAction}>
            {actionTitle}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32, paddingVertical: 48 },
  banner: {
    borderRadius: theme.radii.md,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bannerText: { flex: 1, lineHeight: 18 },
  bannerAction: { fontWeight: "700" },
});
