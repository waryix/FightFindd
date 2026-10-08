"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DISCIPLINES, type GymOwnerOnboardingState } from "@fightfind/types";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../../../src/lib/api";
import { usePortalAuth } from "../../../../src/lib/auth-context";
import { openRazorpayCheckout } from "../../../../src/lib/razorpay";
import { Button, Card, Field, LoadingState, SectionTitle, StatusChip, inputClass } from "../../../../src/components/ui";

const STEP_ORDER: GymOwnerOnboardingState["step"][] = [
  "gym_details",
  "business_details",
  "razorpay_linked_account",
  "listing_payment",
  "platform_subscription",
  "verification",
  "active",
];

const STEP_LABELS: Record<GymOwnerOnboardingState["step"], string> = {
  account: "Account",
  gym_details: "Gym details",
  business_details: "Business details",
  razorpay_linked_account: "Payout account",
  listing_payment: "Listing fee",
  platform_subscription: "Platform plan",
  verification: "Verification",
  active: "Live",
};

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = usePortalAuth();

  const onboardingQuery = useQuery({
    queryKey: ["onboarding"],
    queryFn: () => api.gymOwner.onboarding(),
  });
  const configQuery = useQuery({ queryKey: ["public-config"], queryFn: () => api.config.publicConfig() });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Gym form
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone?.replace("+91", "") ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [timings, setTimings] = useState("Mon-Sat 6-9am, 5-9pm");
  const [feeRupees, setFeeRupees] = useState("3500");
  const [hasTrial, setHasTrial] = useState(true);
  const [disciplines, setDisciplines] = useState<string[]>(["mma"]);

  const onboarding = onboardingQuery.data?.onboarding;
  const pricing = configQuery.data?.pricing;
  const isMockMode = configQuery.data?.paymentMode === "mock";
  const gymId = onboarding?.gymId ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    void queryClient.invalidateQueries({ queryKey: ["owner-gyms"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    if (onboarding?.step === "active") router.replace("/gym/dashboard");
  }, [onboarding?.step, router]);

  const stepIndex = useMemo(
    () => (onboarding ? Math.max(0, STEP_ORDER.indexOf(onboarding.step)) : 0),
    [onboarding],
  );

  const createGym = useMutation({
    mutationFn: () =>
      api.gymOwner.createGym({
        name: name.trim(),
        ownerName: ownerName.trim() || undefined,
        phone: phone.replace(/\D/g, "").slice(-10) || undefined,
        email: email.trim() || undefined,
        description: description.trim() || null,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim() || null,
        timings: timings.trim() || null,
        monthlyFeePaise: Math.round(Number(feeRupees || 0) * 100),
        hasTrialClass: hasTrial,
        disciplines: disciplines as never[],
        latitude: 12.9716,
        longitude: 77.5946,
      }),
  });

  const updateGym = useMutation({
    mutationFn: () =>
      api.gymOwner.updateGym(gymId!, {
        ownerName: ownerName.trim() || undefined,
        phone: phone.replace(/\D/g, "").slice(-10) || undefined,
        email: email.trim() || undefined,
      }),
  });

  const handleCreateGym = async () => {
    setError("");
    setBusy(true);
    try {
      await createGym.mutateAsync();
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save gym details.");
    } finally {
      setBusy(false);
    }
  };

  const handleBusinessDetails = async () => {
    setError("");
    setBusy(true);
    try {
      await updateGym.mutateAsync();
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save business details.");
    } finally {
      setBusy(false);
    }
  };

  const handleRazorpay = async () => {
    setError("");
    setBusy(true);
    try {
      await api.gymOwner.startRazorpayOnboarding(gymId!);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout onboarding.");
    } finally {
      setBusy(false);
    }
  };

  const handleListingFee = async () => {
    setError("");
    setBusy(true);
    try {
      const order = await api.gymOwner.payListingFee(gymId!);
      if (isMockMode || !configQuery.data?.razorpayKeyId) {
        await api.raw.post(`/api/v1/payments/${order.paymentId}/simulate`);
      } else {
        const result = await openRazorpayCheckout({
          keyId: order.razorpayKeyId,
          orderId: order.razorpayOrderId,
          amountPaise: order.amountPaise,
          currency: order.currency,
          name: "FightFind",
          description: "Gym listing fee",
        });
        if (!result?.razorpay_signature) {
          setError("Checkout was closed before payment.");
          return;
        }
        await api.payments.verify({
          razorpayOrderId: result.razorpay_order_id ?? order.razorpayOrderId,
          razorpayPaymentId: result.razorpay_payment_id,
          razorpaySignature: result.razorpay_signature,
        });
      }
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Listing fee payment failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubscription = async () => {
    setError("");
    setBusy(true);
    try {
      if (isMockMode || !configQuery.data?.razorpayKeyId) {
        const result = await api.subscriptions.createGymPlatform(gymId!);
        await api.raw.post(`/api/v1/subscriptions/${result.subscription.id}/dev-activate`);
        invalidate();
        return;
      }

      let subscriptionId: string | null = null;
      try {
        const result = await api.subscriptions.createGymPlatform(gymId!);
        subscriptionId = result.subscription.id;
      } catch (err) {
        // Subscriptions unavailable on the Razorpay account → monthly order pass.
        const code = (err as { code?: string }).code;
        if (code !== "PRODUCT_NOT_CONFIGURED") throw err;
      }

      if (subscriptionId) {
        const checkout = await openRazorpayCheckout({
          keyId: configQuery.data.razorpayKeyId,
          subscriptionId,
          name: "FightFind",
          description: "Gym platform plan — monthly",
        });
        if (!checkout?.razorpay_signature) {
          setError("Checkout was closed before the subscription was confirmed.");
          return;
        }
        await api.subscriptions.verify(subscriptionId, {
          razorpayPaymentId: checkout.razorpay_payment_id,
          razorpaySubscriptionId: checkout.razorpay_subscription_id ?? "",
          razorpaySignature: checkout.razorpay_signature,
        });
      } else {
        const order = await api.payments.createOrder("GYM_PLATFORM_SUBSCRIPTION", gymId!);
        const checkout = await openRazorpayCheckout({
          keyId: order.razorpayKeyId,
          orderId: order.razorpayOrderId,
          amountPaise: order.amountPaise,
          currency: order.currency,
          name: "FightFind",
          description: "Gym platform plan — monthly",
        });
        if (!checkout?.razorpay_signature) {
          setError("Checkout was closed before the payment was confirmed.");
          return;
        }
        await api.payments.verify({
          razorpayOrderId: checkout.razorpay_order_id ?? order.razorpayOrderId,
          razorpayPaymentId: checkout.razorpay_payment_id,
          razorpaySignature: checkout.razorpay_signature,
        });
      }
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription setup failed.");
    } finally {
      setBusy(false);
    }
  };

  if (onboardingQuery.isPending || configQuery.isPending) return <LoadingState message="Loading onboarding…" />;
  if (onboardingQuery.isError || !onboarding) {
    return <LoadingState message="Preparing your gym account…" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Set up your gym on FightFind</h1>
        <p className="text-sm text-muted">
          Complete the steps below to list your gym and start receiving membership payments.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEP_ORDER.filter((step) => step !== "business_details").map((step, index, all) => {
          const currentIndex = all.indexOf(onboarding.step as never);
          const active = step === onboarding.step;
          const done = currentIndex > -1 && index < currentIndex;
          return (
            <li
              key={step}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : done
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border text-muted"
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                {done ? "✓" : index + 1}
              </span>
              {STEP_LABELS[step]}
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {onboarding.step === "gym_details" ? (
        <Card className="space-y-4">
          <SectionTitle>Gym details</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gym name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Iron Fist MMA" />
            </Field>
            <Field label="Owner name">
              <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
            </Field>
            <Field label="Email">
              <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@gym.in" />
            </Field>
          </div>
          <Field label="Address">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="5th Block, Koramangala" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
            </Field>
            <Field label="State">
              <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} placeholder="Karnataka" />
            </Field>
            <Field label="Pincode">
              <input className={inputClass} value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="560095" />
            </Field>
          </div>
          <Field label="Timings">
            <input className={inputClass} value={timings} onChange={(e) => setTimings(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly membership fee (₹)">
              <input className={inputClass} value={feeRupees} inputMode="decimal" onChange={(e) => setFeeRupees(e.target.value)} />
            </Field>
            <Field label="Free trial class?">
              <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm">
                <input type="checkbox" checked={hasTrial} onChange={(e) => setHasTrial(e.target.checked)} />
                Yes, offer a free trial
              </label>
            </Field>
          </div>
          <Field label="Disciplines">
            <div className="flex flex-wrap gap-2">
              {DISCIPLINES.map((discipline) => (
                <button
                  key={discipline}
                  type="button"
                  onClick={() =>
                    setDisciplines((prev) =>
                      prev.includes(discipline) ? prev.filter((d) => d !== discipline) : [...prev, discipline],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                    disciplines.includes(discipline)
                      ? "border-primary bg-primary text-white"
                      : "border-border text-muted"
                  }`}
                >
                  {discipline.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-24`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell fighters what makes your gym great."
            />
          </Field>
          <Button
            onClick={handleCreateGym}
            loading={busy}
            disabled={!name || !address || !city || !state || disciplines.length === 0}
            className="w-full"
          >
            Save gym details
          </Button>
          <p className="text-xs text-muted">
            Location is set to your city centre for now — you can refine the map location in Gym Profile later.
          </p>
        </Card>
      ) : null}

      {onboarding.step === "business_details" ? (
        <Card className="space-y-4">
          <SectionTitle>Business details</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name">
              <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </Field>
            <Field label="Business phone">
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Business email">
              <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Button onClick={handleBusinessDetails} loading={busy} className="w-full">
            Continue
          </Button>
        </Card>
      ) : null}

      {onboarding.step === "razorpay_linked_account" ? (
        <Card className="space-y-4">
          <SectionTitle>Payout account</SectionTitle>
          <p className="text-sm text-muted">
            Gym membership payments are transferred directly to your gym's payout account through Razorpay. FightFind
            never stores your bank details.
          </p>
          {onboarding.razorpayLinkedAccountId ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Account</span>
                <span className="font-mono text-xs">{onboarding.razorpayLinkedAccountId}</span>
                <StatusChip status={onboarding.razorpayOnboardingStatus} />
              </div>
              {onboarding.razorpayOnboardingStatus === "activated" ? (
                <Button onClick={invalidate} className="w-full">
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.gymOwner.refreshRazorpayStatus(gymId!);
                      invalidate();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  loading={busy}
                >
                  Refresh status
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={handleRazorpay} loading={busy} className="w-full">
              Connect payout account with Razorpay
            </Button>
          )}
        </Card>
      ) : null}

      {onboarding.step === "listing_payment" ? (
        <Card className="space-y-4">
          <SectionTitle>List your gym on FightFind</SectionTitle>
          <div className="space-y-2 rounded-xl border border-border bg-surface-raised p-4 text-sm">
            <div className="flex items-center justify-between">
              <span>One-time listing fee</span>
              <span className="font-bold">{formatPaise(pricing?.gymListingFeePaise ?? 99900)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Platform plan</span>
              <span className="font-bold">{formatPaise(pricing?.gymPlatformMonthlyPaise ?? 39900)}/month</span>
            </div>
            <p className="text-xs text-muted">
              Your gym's membership payments are paid directly through FightFind to your linked payout account. These
              FightFind fees are separate from your membership revenue.
            </p>
          </div>
          <Button onClick={handleListingFee} loading={busy} className="w-full">
            Pay listing fee
          </Button>
        </Card>
      ) : null}

      {onboarding.step === "platform_subscription" ? (
        <Card className="space-y-4">
          <SectionTitle>Monthly platform plan</SectionTitle>
          <p className="text-sm text-muted">
            Your listing stays live while the FightFind platform plan is active. It is{" "}
            <span className="font-bold text-foreground">{formatPaise(pricing?.gymPlatformMonthlyPaise ?? 39900)}/month</span>
            , billed through Razorpay, cancel anytime.
          </p>
          <Button onClick={handleSubscription} loading={busy} className="w-full">
            Start monthly plan
          </Button>
        </Card>
      ) : null}

      {onboarding.step === "verification" ? (
        <Card className="space-y-3">
          <SectionTitle>Verification in progress</SectionTitle>
          <p className="text-sm text-muted">
            Your gym is submitted for verification. FightFind reviews listings manually to keep the network trusted.
            You will be notified when it is verified and live.
          </p>
          <StatusChip status={onboarding.verificationStatus} />
          <Button variant="secondary" onClick={() => router.push("/gym/dashboard")} className="w-full">
            Go to dashboard
          </Button>
        </Card>
      ) : null}

      {onboarding.step === "active" ? (
        <Card className="space-y-3">
          <SectionTitle>Your gym is live</SectionTitle>
          <Button onClick={() => router.push("/gym/dashboard")} className="w-full">
            Open dashboard
          </Button>
        </Card>
      ) : null}

      <p className="text-center text-xs text-muted-dark">Step {stepIndex + 1} of {STEP_ORDER.length - 1}</p>
    </div>
  );
}
