import { ActivityIndicator, StyleSheet, View } from "react-native";
import { theme } from "@fightfind/config";
import { AppText } from "./primitives.js";
import { Button } from "./Button.js";

/**
 * Canonical payment UI states. Client callbacks never mark a payment as final;
 * the view mirrors server-confirmed state.
 */
export type PaymentUiState =
  | "creating_order"
  | "checkout_open"
  | "payment_processing"
  | "payment_success"
  | "payment_failed"
  | "verification_pending"
  | "verification_failed"
  | "refunded";

const COPY: Record<PaymentUiState, { title: string; message: string; tone: string }> = {
  creating_order: {
    title: "Preparing payment",
    message: "Creating a secure order with Razorpay…",
    tone: theme.colors.info,
  },
  checkout_open: {
    title: "Checkout open",
    message: "Complete the payment in the Razorpay window.",
    tone: theme.colors.info,
  },
  payment_processing: {
    title: "Processing payment",
    message: "Payment received. Confirming your transaction…",
    tone: theme.colors.warning,
  },
  payment_success: {
    title: "Payment successful",
    message: "Your payment has been confirmed.",
    tone: theme.colors.success,
  },
  payment_failed: {
    title: "Payment failed",
    message: "The payment did not go through. You can try again.",
    tone: theme.colors.danger,
  },
  verification_pending: {
    title: "Confirming payment",
    message: "Payment received. Confirming your transaction…",
    tone: theme.colors.warning,
  },
  verification_failed: {
    title: "Verification failed",
    message: "We could not verify this payment. No membership was activated. Contact support if money was deducted.",
    tone: theme.colors.danger,
  },
  refunded: {
    title: "Refunded",
    message: "This payment has been refunded.",
    tone: theme.colors.info,
  },
};

export function PaymentStatusView({
  state,
  detail,
  onRetry,
}: {
  state: PaymentUiState;
  detail?: string | null;
  onRetry?: () => void;
}) {
  const copy = COPY[state];
  const busy = state === "creating_order" || state === "payment_processing" || state === "verification_pending";
  return (
    <View style={styles.container}>
      {busy ? <ActivityIndicator color={copy.tone} size="large" /> : <View style={[styles.dot, { backgroundColor: copy.tone }]} />}
      <AppText variant="heading" center>
        {copy.title}
      </AppText>
      <AppText variant="caption" center>
        {detail ?? copy.message}
      </AppText>
      {onRetry && (state === "payment_failed" || state === "verification_failed") ? (
        <Button title="Try again" onPress={onRetry} fullWidth={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 12, paddingVertical: 32, paddingHorizontal: 24 },
  dot: { width: 56, height: 56, borderRadius: 28 },
});
