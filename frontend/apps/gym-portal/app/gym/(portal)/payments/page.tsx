"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@fightfind/utils";
import type { PaymentRecord } from "@fightfind/types";
import { api } from "../../../../src/lib/api";
import { Card, EmptyState, ErrorState, LoadingState, SectionTitle, StatCard, StatusChip } from "../../../../src/components/ui";

interface TransferInfo {
  status: string;
  transferId: string | null;
  amountPaise: number;
}

export default function PaymentsPage() {
  const gymsQuery = useQuery({ queryKey: ["owner-gyms"], queryFn: () => api.gymOwner.listGyms() });
  const gym = gymsQuery.data?.gyms[0] ?? null;

  const paymentsQuery = useQuery({
    queryKey: ["gym-payments", gym?.id],
    queryFn: () => api.gymOwner.payments(gym!.id, { limit: 100 }),
    enabled: Boolean(gym?.id),
  });

  const configQuery = useQuery({ queryKey: ["public-config"], queryFn: () => api.config.publicConfig() });

  const totals = useMemo(() => {
    const items = (paymentsQuery.data?.items ?? []) as (PaymentRecord & { transfer?: TransferInfo | null })[];
    const membershipCaptured = items
      .filter((p) => p.type === "GYM_MEMBERSHIP" && p.status === "captured")
      .reduce((sum, p) => sum + p.amountPaise, 0);
    const listingPaid = items.some((p) => p.type === "GYM_LISTING" && p.status === "captured");
    const transferred = items
      .filter((p) => p.transfer?.status === "processed")
      .reduce((sum, p) => sum + (p.transfer?.amountPaise ?? 0), 0);
    const processing = items.filter(
      (p) => p.transfer && ["created", "processing"].includes(p.transfer.status),
    ).length;
    return { membershipCaptured, listingPaid, transferred, processing, items };
  }, [paymentsQuery.data]);

  if (gymsQuery.isPending || paymentsQuery.isPending) return <LoadingState message="Loading payments…" />;
  if (!gym) return <EmptyState title="No gym yet" message="Complete onboarding first." />;
  if (paymentsQuery.isError) {
    return (
      <ErrorState
        message="Couldn't load payments"
        detail={paymentsQuery.error instanceof Error ? paymentsQuery.error.message : undefined}
        onRetry={() => void paymentsQuery.refetch()}
      />
    );
  }

  const platformMonthly = configQuery.data?.pricing.gymPlatformMonthlyPaise ?? 39900;
  const listingFee = configQuery.data?.pricing.gymListingFeePaise ?? 99900;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Payments</h1>
        <p className="text-sm text-muted">
          FightFind fees and customer membership revenue are kept strictly separate.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Membership revenue"
          value={formatPaise(totals.membershipCaptured)}
          hint="Paid by fighters"
          tone="primary"
        />
        <StatCard
          label="Transferred to gym"
          value={formatPaise(totals.transferred)}
          hint={totals.processing > 0 ? `${totals.processing} transfer(s) processing` : "Settled via Razorpay Route"}
        />
        <StatCard label="FightFind fees" value={formatPaise(platformMonthly)} hint="Platform plan / month" />
        <StatCard
          label="Listing fee"
          value={totals.listingPaid ? "PAID" : formatPaise(listingFee)}
          hint={totals.listingPaid ? `One-time ${formatPaise(listingFee)}` : "One-time listing fee due"}
          tone={totals.listingPaid ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <SectionTitle>Revenue</SectionTitle>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Membership payments</span>
            <span className="font-bold">{formatPaise(totals.membershipCaptured)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Transfers to your account</span>
            <span className="font-bold">{formatPaise(totals.transferred)}</span>
          </div>
          {totals.processing > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-warning">Processing transfers</span>
              <span className="font-bold text-warning">{totals.processing}</span>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <SectionTitle>FightFind fees</SectionTitle>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Platform plan</span>
            <span className="font-bold">{formatPaise(platformMonthly)}/month</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Listing fee (one-time)</span>
            <StatusChip status={totals.listingPaid ? "paid" : "unpaid"} />
          </div>
          <p className="text-xs text-muted">
            These fees are paid to FightFind and are never mixed into your membership revenue.
          </p>
        </Card>
      </div>

      <div>
        <SectionTitle>Transactions</SectionTitle>
        {totals.items.length === 0 ? (
          <EmptyState title="No payments yet" message="Membership payments will appear here." />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-surface-raised text-xs uppercase tracking-wider text-muted-dark">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Transfer</th>
                  <th className="px-4 py-3">Provider ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {totals.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-muted">
                      {new Date(payment.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {payment.type === "GYM_MEMBERSHIP"
                        ? "Membership"
                        : payment.type === "GYM_LISTING"
                          ? "FightFind listing fee"
                          : payment.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={payment.status} />
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatPaise(payment.amountPaise)}</td>
                    <td className="px-4 py-3">
                      {payment.transfer ? <StatusChip status={payment.transfer.status} /> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted">
                        {payment.providerPaymentId ?? payment.providerOrderId ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
