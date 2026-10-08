"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../../../src/lib/api";
import { usePortalAuth } from "../../../../src/lib/auth-context";
import { Button, Card, LoadingState, SectionTitle, StatusChip } from "../../../../src/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = usePortalAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const gymsQuery = useQuery({ queryKey: ["owner-gyms"], queryFn: () => api.gymOwner.listGyms() });
  const gym = gymsQuery.data?.gyms[0] ?? null;
  const onboardingQuery = useQuery({ queryKey: ["onboarding"], queryFn: () => api.gymOwner.onboarding() });
  const configQuery = useQuery({ queryKey: ["public-config"], queryFn: () => api.config.publicConfig() });

  if (gymsQuery.isPending || onboardingQuery.isPending) return <LoadingState message="Loading settings…" />;

  const platformMonthly = configQuery.data?.pricing.gymPlatformMonthlyPaise ?? 39900;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-muted">Account, payout and platform plan settings.</p>
      </div>

      {message ? <p className="rounded-xl border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">{message}</p> : null}

      <Card className="space-y-3">
        <SectionTitle>Account</SectionTitle>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Name</span>
          <span className="font-semibold">{user?.name ?? "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Phone</span>
          <span className="font-semibold">{user?.phone ?? "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Email</span>
          <span className="font-semibold">{user?.email ?? "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Roles</span>
          <span className="font-semibold">{user?.roles.join(", ")}</span>
        </div>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Payout account</SectionTitle>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Razorpay linked account</span>
          <span className="font-mono text-xs">
            {onboardingQuery.data?.onboarding.razorpayLinkedAccountId ?? "Not connected"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Onboarding status</span>
          <StatusChip status={onboardingQuery.data?.onboarding.razorpayOnboardingStatus ?? "not_started"} />
        </div>
        {gym ? (
          <Button
            variant="secondary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api.gymOwner.startRazorpayOnboarding(gym.id);
                setMessage(
                  result.onboardingUrl
                    ? `Continue payout setup in Razorpay: ${result.onboardingUrl}`
                    : "Payout account status refreshed.",
                );
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Could not update payout account.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Start / resume payout account update
          </Button>
        ) : null}
        <p className="text-xs text-muted">
          Bank details live inside Razorpay. FightFind only stores the linked account id and onboarding status.
        </p>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>FightFind platform plan</SectionTitle>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Status</span>
          <StatusChip status={onboardingQuery.data?.onboarding.subscriptionStatus ?? "none"} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Price</span>
          <span className="font-semibold">{formatPaise(platformMonthly)}/month</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Listing fee</span>
          <StatusChip status={onboardingQuery.data?.onboarding.listingPaymentStatus ?? "unpaid"} />
        </div>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Notifications</SectionTitle>
        <p className="text-sm text-muted">
          Membership requests, payments, subscription renewals and system notices are shown in Requests and delivered
          to your registered contact details. Push and email delivery are best-effort and never block a transaction.
        </p>
      </Card>

      <Button
        variant="danger"
        onClick={async () => {
          await signOut();
          router.replace("/gym/login");
        }}
      >
        Log out
      </Button>
    </div>
  );
}
