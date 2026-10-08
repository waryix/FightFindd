import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Divider, ErrorState, LoadingState, PaymentStatusView, PriceRow, ScreenScroll, SectionLabel, AppText, type PaymentUiState } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../../src/api/client";
import { errorMessage } from "../../../src/api/errors";
import { CheckoutModal } from "../../../src/components/CheckoutModal";
import {
  beginCheckoutWindow,
  buildPaymentCheckoutUrl,
  isWeb,
  navigateCheckoutWindow,
} from "../../../src/services/checkout";
import { track } from "../../../src/analytics";

interface OrderDraft {
  paymentId: string;
  razorpayOrderId: string;
  amountPaise: number;
}

export default function MembershipCheckoutScreen() {
  const router = useRouter();
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const [stage, setStage] = useState<PaymentUiState | "review">("review");
  const [detail, setDetail] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDraft | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gymQuery = useQuery({
    queryKey: ["gym", gymId],
    queryFn: () => api.gyms.get(gymId!, {}),
    enabled: Boolean(gymId),
  });

  const configQuery = useQuery({
    queryKey: ["public-config"],
    queryFn: () => api.config.publicConfig(),
    staleTime: 5 * 60_000,
  });

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const pollMembership = useCallback(async () => {
    setStage("payment_processing");
    let attempts = 0;
    stopPolling();
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const { membership } = await api.gyms.myMembership(gymId!);
        if (membership && membership.status !== "pending_payment" && membership.status !== "payment_failed") {
          stopPolling();
          setMembershipStatus(membership.status);
          setStage("payment_success");
          track("gym_payment_success", { gymId, status: membership.status });
        } else if (attempts >= 20) {
          stopPolling();
          setStage("verification_pending");
          setDetail("Payment received. Confirming your transaction — check Memberships in a moment.");
        }
      } catch {
        // Keep polling; transient errors are fine.
      }
    }, 1500);
  }, [gymId, stopPolling]);

  const startPayment = async () => {
    if (!gymId) return;
    setStage("creating_order");
    setDetail(null);
    // On web, open a popup synchronously so the async order call can't get it blocked.
    const popup = isWeb && configQuery.data?.paymentMode !== "mock" ? beginCheckoutWindow() : null;
    try {
      const created = await api.gyms.membershipOrder(gymId);
      setOrder({
        paymentId: created.paymentId,
        razorpayOrderId: created.razorpayOrderId,
        amountPaise: created.amountPaise,
      });
      track("gym_payment_started", { gymId, amountPaise: created.amountPaise });
      if (created.testMode && configQuery.data?.paymentMode === "mock") {
        popup?.close();
        setStage("checkout_open");
        setDetail("Development mode: simulate a successful payment below.");
        return;
      }
      const url = buildPaymentCheckoutUrl(created.paymentId);
      if (isWeb) {
        navigateCheckoutWindow(popup, url);
        setStage("payment_processing");
        void pollMembership();
      } else {
        setCheckoutUrl(url);
        setStage("checkout_open");
      }
    } catch (err) {
      popup?.close();
      setStage("payment_failed");
      setDetail(errorMessage(err));
    }
  };

  const simulatePayment = async () => {
    if (!order) return;
    setStage("payment_processing");
    try {
      await api.raw.post(`/api/v1/payments/${order.paymentId}/simulate`);
      await pollMembership();
    } catch (err) {
      setStage("payment_failed");
      setDetail(errorMessage(err));
    }
  };

  const handleCheckoutResult = async (params: Record<string, string>) => {
    setCheckoutUrl(null);
    if (params.status === "dismissed") {
      setStage("review");
      setDetail("Checkout closed before payment. Your membership is still pending payment.");
      return;
    }
    if (!order) return;
    setStage("payment_processing");
    try {
      const result = await api.payments.verify({
        razorpayOrderId: params.razorpay_order_id || order.razorpayOrderId,
        razorpayPaymentId: params.razorpay_payment_id ?? "",
        razorpaySignature: params.razorpay_signature ?? "",
      });
      if (result.status === "captured") {
        await pollMembership();
      } else {
        setStage("verification_pending");
        setDetail("Payment received. Confirming your transaction…");
        await pollMembership();
      }
    } catch (err) {
      setStage("verification_failed");
      setDetail(errorMessage(err));
    }
  };

  if (gymQuery.isPending) return <LoadingState message="Preparing checkout…" />;
  if (gymQuery.isError) {
    return <ErrorState message="Couldn't load this gym" detail={errorMessage(gymQuery.error)} onRetry={() => void gymQuery.refetch()} />;
  }

  const gym = gymQuery.data.gym;
  const fee = gym.monthlyFeePaise ?? 0;
  const isMockMode = configQuery.data?.paymentMode === "mock";

  if (stage === "payment_success") {
    return (
      <ScreenScroll contentStyle={styles.centered}>
        <PaymentStatusView
          state="payment_success"
          detail={
            membershipStatus === "paid_pending_approval"
              ? "Your membership request has been sent to the gym. Status: Pending gym approval."
              : membershipStatus === "active"
                ? "Your membership is active. See you at the gym!"
                : "Payment confirmed."
          }
        />
        <Button title="View Memberships" onPress={() => router.replace("/(tabs)/memberships")} />
        <Button title="Back to Gyms" variant="secondary" onPress={() => router.replace("/(tabs)/gyms")} />
      </ScreenScroll>
    );
  }

  if (stage !== "review") {
    return (
      <ScreenScroll contentStyle={styles.centered}>
        <PaymentStatusView
          state={stage}
          detail={detail}
          onRetry={
            stage === "payment_failed" || stage === "verification_failed"
              ? () => {
                  setStage("review");
                  setDetail(null);
                }
              : undefined
          }
        />
        {stage === "checkout_open" && isMockMode ? (
          <View style={styles.mockBox}>
            <AppText variant="caption" color={theme.colors.warning}>
              Development payment simulator enabled (PAYMENT_MODE=mock).
            </AppText>
            <Button title="Simulate successful payment" onPress={simulatePayment} />
          </View>
        ) : null}
        <CheckoutModal
          visible={Boolean(checkoutUrl)}
          url={checkoutUrl}
          onClose={() => {
            setCheckoutUrl(null);
            setStage("review");
          }}
          onResult={(params) => void handleCheckoutResult(params)}
        />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <AppText variant="title">Join {gym.name}</AppText>
      <Card style={styles.summary}>
        <AppText variant="bodyStrong">Monthly Membership</AppText>
        <AppText variant="caption" color={theme.colors.textSecondary}>
          {gym.city}, {gym.state}
        </AppText>
        <Divider />
        <PriceRow label="Membership" amountPaise={fee} />
        <PriceRow label="Amount payable" amountPaise={fee} emphasis />
        {gym.hasTrialClass ? (
          <AppText variant="caption" color={theme.colors.success}>
            This gym offers a free trial class.
          </AppText>
        ) : null}
      </Card>

      <SectionLabel>How it works</SectionLabel>
      <AppText variant="caption" color={theme.colors.textSecondary} style={styles.howItWorks}>
        Pay securely through Razorpay. Your payment goes to the gym through FightFind. The gym is notified and
        approves your membership. If the gym needs to reject the request, the payment is refunded.
      </AppText>

      {detail ? (
        <AppText variant="caption" color={theme.colors.warning}>
          {detail}
        </AppText>
      ) : null}

      <Button title={`Continue to Payment${fee ? ` · ${formatPaise(fee)}` : ""}`} size="lg" onPress={startPayment} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: "center" },
  summary: { gap: 10 },
  howItWorks: { lineHeight: 20 },
  mockBox: { gap: 10, borderWidth: 1, borderColor: theme.colors.warning + "66", backgroundColor: theme.colors.warningSoft, padding: 14, borderRadius: theme.radii.lg },
});
