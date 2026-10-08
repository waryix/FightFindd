import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, PaymentStatusView, ScreenScroll, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { api } from "../src/api/client";
import { errorMessage } from "../src/api/errors";
import type { PaymentUiState } from "@fightfind/ui";

/**
 * Deep-link target for payment checkout callbacks (fightfind://payment-result).
 * Verification always happens server-side; this screen only reflects state.
 */
export default function PaymentResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [stage, setStage] = useState<PaymentUiState>("payment_processing");
  const [detail, setDetail] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        if (params.paymentId && params.razorpay_payment_id) {
          const result = await api.payments.verify({
            razorpayOrderId: params.razorpay_order_id ?? "",
            razorpayPaymentId: params.razorpay_payment_id,
            razorpaySignature: params.razorpay_signature ?? "",
          });
          setStage("payment_success");
          setMembershipStatus(result.businessState.membershipStatus ?? null);
          return;
        }
        if (params.subscriptionId) {
          const { subscription } = await api.subscriptions.sync(params.subscriptionId);
          if (subscription.status === "active") {
            setStage("payment_success");
            setDetail("Your subscription is active.");
          } else {
            setStage("verification_pending");
            setDetail("We are confirming your subscription. This can take a few seconds.");
          }
          return;
        }
        setStage("payment_failed");
        setDetail("No payment information was returned.");
      } catch (error) {
        setStage("verification_failed");
        setDetail(errorMessage(error));
      }
    })();
  }, []);

  return (
    <ScreenScroll contentStyle={styles.content}>
      <PaymentStatusView state={stage} detail={detail} />
      {stage === "payment_success" && membershipStatus ? (
        <AppText variant="caption" center color={theme.colors.textSecondary}>
          Membership status: {membershipStatus.replace(/_/g, " ")}
        </AppText>
      ) : null}
      <Button title="View Memberships" onPress={() => router.replace("/(tabs)/memberships")} />
      <Button title="Back to Discover" variant="secondary" onPress={() => router.replace("/(tabs)/discover")} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
});
