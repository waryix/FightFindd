"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPaise } from "@fightfind/utils";
import { api } from "../../../../src/lib/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusChip } from "../../../../src/components/ui";

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const gymsQuery = useQuery({ queryKey: ["owner-gyms"], queryFn: () => api.gymOwner.listGyms() });
  const gym = gymsQuery.data?.gyms[0] ?? null;

  const requestsQuery = useQuery({
    queryKey: ["requests", gym?.id],
    queryFn: () => api.gymOwner.requests(gym!.id),
    enabled: Boolean(gym?.id),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) =>
      action === "accept" ? api.gymOwner.acceptMembership(id) : api.gymOwner.declineMembership(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Action failed."),
  });

  if (gymsQuery.isPending || requestsQuery.isPending) return <LoadingState message="Loading requests…" />;
  if (!gym) return <EmptyState title="No gym yet" message="Complete onboarding first." />;
  if (requestsQuery.isError) {
    return (
      <ErrorState
        message="Couldn't load requests"
        detail={requestsQuery.error instanceof Error ? requestsQuery.error.message : undefined}
        onRetry={() => void requestsQuery.refetch()}
      />
    );
  }

  const requests = requestsQuery.data.items;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Requests</h1>
        <p className="text-sm text-muted">
          Fighters who paid and requested membership at {gym.name}. Payment is already collected — accepting activates
          their membership.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {requests.length === 0 ? (
        <EmptyState title="No pending requests" message="New membership requests will appear here in real time." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((request) => (
            <Card key={request.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{request.fighter?.name ?? "Fighter"}</p>
                  <p className="text-sm text-muted capitalize">
                    {request.fighter?.skillLevel ?? "—"} · {(request.fighter?.weightClass ?? "").replace(/_/g, " ")} ·{" "}
                    {request.fighter?.city ?? ""}
                  </p>
                </div>
                <StatusChip status={request.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-raised p-3 text-center text-xs">
                <div>
                  <p className="text-muted-dark">Experience</p>
                  <p className="font-bold text-foreground">{request.fighter?.yearsExperience ?? 0} yrs</p>
                </div>
                <div>
                  <p className="text-muted-dark">Fights (A/P)</p>
                  <p className="font-bold text-foreground">
                    {request.fighter?.totalAmateurFights ?? 0}/{request.fighter?.totalProFights ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-muted-dark">Discipline</p>
                  <p className="font-bold capitalize text-foreground">
                    {(request.fighter?.disciplines?.[0] ?? "—").replace(/_/g, " ")}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  Request date:{" "}
                  {request.requestDate
                    ? new Date(request.requestDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </span>
                <span className="font-bold">
                  Payment: <StatusChip status="captured" label={`${formatPaise(request.amountPaise)} PAID`} />
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => window.open(`/gym/members?highlight=${request.id}`, "_self")}
                  className="flex-1"
                >
                  View fighter
                </Button>
                <Button
                  variant="danger"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ id: request.id, action: "decline" })}
                  className="flex-1"
                >
                  Decline
                </Button>
                <Button
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ id: request.id, action: "accept" })}
                  className="flex-1"
                >
                  Accept
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
