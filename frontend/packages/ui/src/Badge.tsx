import { StyleSheet, Text, View } from "react-native";
import { theme, type StatusTone } from "@fightfind/config";

interface BadgeProps {
  label: string;
  tone?: StatusTone;
  color?: string;
  softColor?: string;
}

export function Badge({ label, tone = "neutral", color, softColor }: BadgeProps) {
  const palette = theme.statusTones[tone];
  const fg = color ?? palette.color;
  const bg = softColor ?? palette.soft;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: fg + "66" }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

export const STATUS_TONES: Record<string, StatusTone> = {
  pending: "warning",
  pending_payment: "warning",
  paid_pending_approval: "info",
  accepted: "success",
  active: "success",
  verified: "success",
  approved: "success",
  captured: "success",
  completed: "info",
  expired: "neutral",
  cancelled: "neutral",
  declined: "danger",
  rejected: "danger",
  failed: "danger",
  payment_failed: "danger",
  verification_rejected: "danger",
  suspended: "danger",
  refunded: "info",
  partially_refunded: "info",
  halted: "danger",
  draft: "neutral",
  awaiting_listing_payment: "warning",
  onboarding: "info",
  pending_verification: "info",
  processing: "info",
  created: "neutral",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge label={label ?? status.replace(/_/g, " ")} tone={STATUS_TONES[status] ?? "neutral"} />;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});
