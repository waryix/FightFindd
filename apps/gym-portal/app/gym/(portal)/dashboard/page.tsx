"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../../../src/lib/api";
import { Card, EmptyState, ErrorState, LoadingState, SectionTitle, StatCard, StatusChip } from "../../../../src/components/ui";

export default function DashboardPage() {
  const gymsQuery = useQuery({ queryKey: ["owner-gyms"], queryFn: () => api.gymOwner.listGyms() });
  const gym = gymsQuery.data?.gyms[0] ?? null;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", gym?.id],
    queryFn: () => api.gymOwner.dashboard(gym!.id),
    enabled: Boolean(gym?.id),
  });

  if (gymsQuery.isPending) return <LoadingState message="Loading your gym…" />;
  if (gymsQuery.isError) {
    return (
      <ErrorState
        message="Couldn't load your gym"
        detail={gymsQuery.error instanceof Error ? gymsQuery.error.message : undefined}
        onRetry={() => void gymsQuery.refetch()}
      />
    );
  }

  if (!gym) {
    return (
      <EmptyState
        title="No gym yet"
        message="Complete onboarding to create your gym profile and start receiving memberships."
        action={
          <Link
            href="/gym/onboarding"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark"
          >
            Start onboarding
          </Link>
        }
      />
    );
  }

  if (dashboardQuery.isPending) return <LoadingState message="Loading dashboard…" />;
  if (dashboardQuery.isError) {
    return (
      <ErrorState
        message="Couldn't load dashboard"
        detail={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : undefined}
        onRetry={() => void dashboardQuery.refetch()}
      />
    );
  }

  const dashboard = dashboardQuery.data.dashboard;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-muted">Live numbers from your FightFind listing and payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={dashboard.gym?.status ?? gym.status} label={`Listing: ${(dashboard.gym?.status ?? gym.status).replace(/_/g, " ")}`} />
          <StatusChip status={dashboard.gym?.verificationStatus ?? gym.verificationStatus} />
        </div>
      </div>

      {dashboard.gym?.status !== "active" ? (
        <Card className="border-warning/40 bg-warning/5">
          <p className="text-sm text-warning">
            Your listing is not live yet.{" "}
            <Link href="/gym/onboarding" className="font-bold underline">
              Continue onboarding
            </Link>{" "}
            to finish setup and go live.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current members" value={dashboard.currentMembers} tone="primary" />
        <StatCard label="Pending requests" value={dashboard.pendingRequests} tone={dashboard.pendingRequests > 0 ? "warning" : "default"} />
        <StatCard label="This month" value={formatPaise(dashboard.monthlyRevenuePaise)} hint="Membership revenue" />
        <StatCard label="Upcoming renewals" value={dashboard.upcomingRenewals} hint="Next 7 days" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <SectionTitle>FightFind platform plan</SectionTitle>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Subscription</span>
            <StatusChip status={dashboard.subscription.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Price</span>
            <span className="font-bold">{formatPaise(dashboard.subscription.pricePaise)}/month</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Next billing</span>
            <span className="text-sm">
              {dashboard.subscription.nextBillingAt
                ? new Date(dashboard.subscription.nextBillingAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>
        </Card>

        <Card className="space-y-3">
          <SectionTitle>Listing</SectionTitle>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Listing fee</span>
            <StatusChip status={dashboard.listingFeePaid ? "paid" : "unpaid"} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Gym profile</span>
            <Link href="/gym/profile" className="text-sm font-bold text-primary hover:underline">
              Manage profile
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Membership requests</span>
            <Link href="/gym/requests" className="text-sm font-bold text-primary hover:underline">
              Review requests
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
