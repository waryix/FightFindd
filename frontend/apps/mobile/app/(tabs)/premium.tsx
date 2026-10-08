import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@fightfind/api-client";
import { Badge, Button, Card, Divider, LoadingState, PaymentStatusView, PriceRow, ScreenScroll, SectionLabel, AppText, type PaymentUiState } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";
import { CheckoutModal } from "../../src/components/CheckoutModal";
import {
  beginCheckoutWindow,
  buildPaymentCheckoutUrl,
  buildSubscriptionCheckoutUrl,
  isWeb,
  navigateCheckoutWindow,
} from "../../src/services/checkout";
import { useAuth } from "../../src/auth/auth-context";
import { track } from "../../src/analytics";

const BENEFITS = [
  "Advanced discovery filters (height, weight, experience, fights)",
  "Unlimited pending sparring requests",
  "Profile boost — appear higher in Best Match",
  "Premium badge on your profile",
];

export default function PremiumScreen() {
  const router = useRouter();
  const { entitlements, refresh, isGuest, status } = useAuth();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<PaymentUiState | "review">("review");
  const [detail, setDetail] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutKind, setCheckoutKind] = useState<"subscription" | "order" | null>(null);
  const orderRef = useRef<{ paymentId: string; razorpayOrderId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const configQuery = useQuery({ queryKey: ["public-config"], queryFn: () => api.config.publicConfig() });
  const subscriptionQuery = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => api.subscriptions.mySubscription(),
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (isGuest) {
      router.replace("/(auth)/signup");
    }
  }, [isGuest, router]);

  const waitForPremium = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const { entitlements: latest } = await api.subscriptions.myEntitlements();
        if (latest.isPremium) return true;
      } catch {
        // keep polling
      }
    }
    return false;
  };

  const finishPremium = async (mode: "subscription" | "order") => {
    const premium = await waitForPremium();
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    if (premium) {
      setStage("payment_success");
      setDetail(
        mode === "order"
          ? "FightFind Pro is active for 30 days. Advanced filters and unlimited requests are unlocked."
          : "FightFind Pro is active. Advanced filters and unlimited requests are unlocked.",
      );
      track("premium_upgrade_success");
    } else {
      setStage("verification_pending");
      setDetail("Payment received. Confirming your subscription — this can take a few seconds.");
    }
  };

  const handleUpgrade = async () => {
    setBusy(true);
    setDetail(null);
    const isMock = configQuery.data?.paymentMode === "mock";
    const popup = isWeb && !isMock ? beginCheckoutWindow() : null;
    try {
      track("premium_upgrade_started");

      if (isMock) {
        const result = await api.subscriptions.createFighterUpgrade();
        setStage("payment_processing");
        await api.raw.post(`/api/v1/subscriptions/${result.subscription.id}/dev-activate`);
        await finishPremium("subscription");
        return;
      }

      let target: { kind: "subscription" | "order"; url: string } | null = null;
      try {
        const result = await api.subscriptions.createFighterUpgrade();
        target = { kind: "subscription", url: buildSubscriptionCheckoutUrl(result.subscription.id) };
      } catch (error) {
        // Razorpay Subscriptions not available on the account → monthly order pass.
        if (error instanceof ApiClientError && error.code === "PRODUCT_NOT_CONFIGURED") {
          const order = await api.payments.createOrder("FIGHTER_UPGRADE");
          orderRef.current = { paymentId: order.paymentId, razorpayOrderId: order.razorpayOrderId };
          target = { kind: "order", url: buildPaymentCheckoutUrl(order.paymentId) };
        } else {
          throw error;
        }
      }

      setCheckoutKind(target.kind);
      if (isWeb) {
        navigateCheckoutWindow(popup, target.url);
        setStage("payment_processing");
        await finishPremium(target.kind);
      } else {
        setCheckoutUrl(target.url);
      }
    } catch (error) {
      popup?.close();
      setStage("payment_failed");
      setDetail(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckoutResult = async (params: Record<string, string>) => {
    setCheckoutUrl(null);
    if (params.status === "dismissed") {
      setStage("review");
      setDetail("Checkout closed before the subscription was confirmed.");
      return;
    }
    setStage("payment_processing");
    try {
      if (checkoutKind === "order") {
        const order = orderRef.current;
        await api.payments.verify({
          razorpayOrderId: params.razorpay_order_id ?? order?.razorpayOrderId ?? "",
          razorpayPaymentId: params.razorpay_payment_id ?? "",
          razorpaySignature: params.razorpay_signature ?? "",
        });
        await finishPremium("order");
        return;
      }
      const subscriptionId = params.subscriptionId ?? subscriptionQuery.data?.subscription?.id;
      if (!subscriptionId) throw new Error("Missing subscription reference.");
      await api.subscriptions.verify(subscriptionId, {
        razorpayPaymentId: params.razorpay_payment_id ?? "",
        razorpaySubscriptionId: params.razorpay_subscription_id ?? "",
        razorpaySignature: params.razorpay_signature ?? "",
      });
      await finishPremium("subscription");
    } catch (error) {
      setStage("verification_failed");
      setDetail(errorMessage(error));
    }
  };

  const handleCancel = async () => {
    const subscription = subscriptionQuery.data?.subscription;
    if (!subscription) return;
    setBusy(true);
    try {
      await api.subscriptions.cancel(subscription.id, true);
      await queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
      await refresh();
      setDetail("Subscription will cancel at the end of the current billing period.");
    } catch (error) {
      setDetail(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (configQuery.isPending) return <LoadingState />;
  const price = configQuery.data?.pricing.fighterPremiumMonthlyPaise ?? 19900;

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
        {stage === "payment_success" ? (
          <Button title="Find fighters with Pro filters" onPress={() => router.replace("/(tabs)/discover")} />
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

  const isPremium = entitlements?.isPremium ?? false;

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <AppText variant="title">FightFind Pro</AppText>
        <View style={styles.priceRow}>
          <AppText variant="hero" color={theme.colors.primary}>
            {formatPaise(price)}
          </AppText>
          <AppText variant="caption">/ month</AppText>
        </View>
        {isPremium ? <Badge label="Active" tone="success" /> : null}
      </View>

      <Card style={styles.benefits}>
        <SectionLabel>What you get</SectionLabel>
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <AppText variant="bodyStrong" color={theme.colors.success}>
              ✓
            </AppText>
            <AppText variant="body" color={theme.colors.textSecondary} style={styles.benefitText}>
              {benefit}
            </AppText>
          </View>
        ))}
        <Divider />
        <PriceRow label="FightFind Pro" amountPaise={price} caption="Billed monthly via Razorpay. Cancel anytime." />
      </Card>

      {detail ? (
        <AppText variant="caption" color={theme.colors.warning}>
          {detail}
        </AppText>
      ) : null}

      {isPremium ? (
        <>
          <Button title="Pro is active" disabled onPress={() => undefined} />
          <Button
            title="Cancel at period end"
            variant="secondary"
            loading={busy}
            onPress={handleCancel}
          />
          <AppText variant="caption" center color={theme.colors.textMuted}>
            Premium stays active until{" "}
            {entitlements?.premiumUntil
              ? new Date(entitlements.premiumUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
              : "the period ends"}
            .
          </AppText>
        </>
      ) : (
        <>
          <Button title={`Upgrade with Razorpay · ${formatPaise(price)}/mo`} size="lg" loading={busy} onPress={handleUpgrade} />
          <AppText variant="caption" center color={theme.colors.textMuted}>
            Secure monthly subscription. Premium activates only after server-side verification.
          </AppText>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: "center" },
  hero: { alignItems: "center", gap: 8, paddingVertical: 12 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  benefits: { gap: 10 },
  benefitRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  benefitText: { flex: 1, lineHeight: 20 },
});
