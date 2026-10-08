"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MembershipStatus } from "@fightfind/types";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../../../src/lib/api";
import { Card, EmptyState, ErrorState, LoadingState, StatusChip } from "../../../../src/components/ui";

const STATUS_FILTERS: { value: MembershipStatus | "all"; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function MembersPage() {
  const [status, setStatus] = useState<MembershipStatus | "all">("active");

  const gymsQuery = useQuery({ queryKey: ["owner-gyms"], queryFn: () => api.gymOwner.listGyms() });
  const gym = gymsQuery.data?.gyms[0] ?? null;

  const membersQuery = useQuery({
    queryKey: ["members", gym?.id, status],
    queryFn: () => api.gymOwner.members(gym!.id, status === "all" ? { limit: 100 } : { status, limit: 100 }),
    enabled: Boolean(gym?.id),
  });

  if (gymsQuery.isPending || membersQuery.isPending) return <LoadingState message="Loading members…" />;
  if (!gym) return <EmptyState title="No gym yet" message="Complete onboarding first." />;
  if (membersQuery.isError) {
    return (
      <ErrorState
        message="Couldn't load members"
        detail={membersQuery.error instanceof Error ? membersQuery.error.message : undefined}
        onRetry={() => void membersQuery.refetch()}
      />
    );
  }

  const members = membersQuery.data.items;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Members</h1>
          <p className="text-sm text-muted">Fighters training at {gym.name}.</p>
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status === filter.value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState title="No members in this view" message="Try a different status filter." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised text-xs uppercase tracking-wider text-muted-dark">
              <tr>
                <th className="px-4 py-3">Fighter</th>
                <th className="hidden px-4 py-3 sm:table-cell">Level</th>
                <th className="hidden px-4 py-3 md:table-cell">Weight class</th>
                <th className="px-4 py-3">Membership</th>
                <th className="hidden px-4 py-3 lg:table-cell">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{member.fighter?.name ?? "Fighter"}</p>
                    <p className="text-xs text-muted">{member.fighter?.city ?? ""}</p>
                  </td>
                  <td className="hidden px-4 py-3 capitalize sm:table-cell">{member.fighter?.skillLevel ?? "—"}</td>
                  <td className="hidden px-4 py-3 capitalize md:table-cell">
                    {(member.fighter?.weightClass ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={member.status} />
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {member.expiresAt
                      ? new Date(member.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="text-xs text-muted">
        Membership fees are collected from fighters through FightFind and transferred to your Razorpay payout account.
        Example: a {formatPaise(members?.[0]?.amountPaise ?? 350000)} membership is paid by the fighter and routed to
        your linked account.
      </Card>
    </div>
  );
}
