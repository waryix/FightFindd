import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  fighterDisciplines,
  fighterProfiles,
  gymMembershipRequests,
  gymMemberships,
  gymProfiles,
} from "../../db/schema.js";
import { conflict, notFound } from "../../lib/errors.js";
import { buildPageWith, decodeCursor, type Page } from "../../lib/cursor.js";
import { loadEnv } from "../../env.js";
import type { FighterSummary, GymMembershipSummary, GymMembershipWithFighter } from "@fightfind/types";
import { canTransitionMembership } from "@fightfind/utils";
import type { MembershipStatus } from "@fightfind/types";
import type { NotificationService } from "../notifications/notifications.service.js";
import type { AuditService } from "../audit/audit.service.js";

export class MembershipService {
  constructor(
    private readonly db: Db,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async createPending(params: {
    gymId: string;
    fighterUserId: string;
    amountPaise: number;
  }) {
    const existing = await this.findActiveOrPending(params.gymId, params.fighterUserId);
    if (existing) {
      if (existing.status === "active") {
        throw conflict("MEMBERSHIP_ALREADY_ACTIVE", "You already have an active membership at this gym.");
      }
      if (existing.status === "pending_payment" || existing.status === "paid_pending_approval") {
        return existing;
      }
    }
    const [membership] = await this.db
      .insert(gymMemberships)
      .values({
        gymId: params.gymId,
        fighterUserId: params.fighterUserId,
        amountPaise: params.amountPaise,
        status: "pending_payment",
      })
      .returning();
    if (!membership) throw new Error("Failed to create membership");
    return membership;
  }

  async attachOrder(membershipId: string, paymentId: string, providerOrderId: string) {
    await this.db
      .update(gymMemberships)
      .set({ paymentId, providerOrderId, updatedAt: new Date() })
      .where(eq(gymMemberships.id, membershipId));
  }

  async findActiveOrPending(gymId: string, fighterUserId: string) {
    const [row] = await this.db
      .select()
      .from(gymMemberships)
      .where(
        and(
          eq(gymMemberships.gymId, gymId),
          eq(gymMemberships.fighterUserId, fighterUserId),
          sql`${gymMemberships.status} in ('pending_payment','paid_pending_approval','active')`,
        ),
      )
      .orderBy(desc(gymMemberships.createdAt))
      .limit(1);
    return row ?? null;
  }

  async markPaymentFailed(membershipId: string): Promise<void> {
    const membership = await this.getById(membershipId);
    if (!membership || membership.status !== "pending_payment") return;
    await this.db
      .update(gymMemberships)
      .set({ status: "payment_failed", updatedAt: new Date() })
      .where(eq(gymMemberships.id, membershipId));
  }

  async getById(membershipId: string) {
    const [row] = await this.db
      .select()
      .from(gymMemberships)
      .where(eq(gymMemberships.id, membershipId))
      .limit(1);
    return row ?? null;
  }

  async getForFighterAndGym(gymId: string, fighterUserId: string) {
    return this.findActiveOrPending(gymId, fighterUserId);
  }

  /**
   * Payment confirmed server-side → membership moves to pending approval and
   * the gym is notified. Idempotent: repeated calls keep a single request.
   */
  async markPaid(params: {
    membershipId: string;
    paymentId: string;
    providerPaymentId: string;
  }): Promise<{ membership: GymMembershipSummary; requestCreated: boolean }> {
    const membership = await this.getById(params.membershipId);
    if (!membership) throw notFound("MEMBERSHIP_NOT_FOUND", "Membership not found");

    if (membership.status === "pending_payment" || membership.status === "payment_failed") {
      await this.db
        .update(gymMemberships)
        .set({
          status: "paid_pending_approval",
          paymentId: params.paymentId,
          providerPaymentId: params.providerPaymentId,
          updatedAt: new Date(),
        })
        .where(eq(gymMemberships.id, membership.id));
    }

    const env = loadEnv();
    if (env.GYM_MEMBERSHIP_AUTO_APPROVE) {
      await this.transition(params.membershipId, "active", { actorUserId: null });
      return { membership: await this.summary(params.membershipId), requestCreated: true };
    }

    const inserted = await this.db
      .insert(gymMembershipRequests)
      .values({
        membershipId: membership.id,
        gymId: membership.gymId,
        fighterUserId: membership.fighterUserId,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ id: gymMembershipRequests.id });

    const [gym] = await this.db
      .select({ name: gymProfiles.name, ownerUserId: gymProfiles.ownerUserId })
      .from(gymProfiles)
      .where(eq(gymProfiles.id, membership.gymId))
      .limit(1);
    const [fighter] = await this.db
      .select({ name: fighterProfiles.name })
      .from(fighterProfiles)
      .where(eq(fighterProfiles.userId, membership.fighterUserId))
      .limit(1);

    if (gym) {
      await this.notifications.notify({
        userId: gym.ownerUserId,
        type: "MEMBERSHIP_REQUEST_RECEIVED",
        title: "New membership request",
        body: `${fighter?.name ?? "A fighter"} requested membership at ${gym.name}.`,
        data: { membershipId: membership.id, gymId: membership.gymId },
      });
    }
    await this.audit.record({
      actorUserId: membership.fighterUserId,
      action: "MEMBERSHIP_PAYMENT_CAPTURED",
      entityType: "gym_membership",
      entityId: membership.id,
      metadata: { paymentId: params.paymentId, providerPaymentId: params.providerPaymentId },
    });

    return { membership: await this.summary(params.membershipId), requestCreated: inserted.length > 0 };
  }

  async accept(membershipId: string, ownerUserId: string) {
    await this.assertOwner(membershipId, ownerUserId);
    const membership = await this.getById(membershipId);
    if (!membership) throw notFound("MEMBERSHIP_NOT_FOUND", "Membership not found");
    if (membership.status === "active") return this.summary(membershipId);
    if (!canTransitionMembership(membership.status as MembershipStatus, "active")) {
      throw conflict("MEMBERSHIP_INVALID_TRANSITION", `Cannot activate a membership in status ${membership.status}.`);
    }
    await this.transition(membershipId, "active", { actorUserId: ownerUserId });
    return this.summary(membershipId);
  }

  async decline(membershipId: string, ownerUserId: string) {
    await this.assertOwner(membershipId, ownerUserId);
    const membership = await this.getById(membershipId);
    if (!membership) throw notFound("MEMBERSHIP_NOT_FOUND", "Membership not found");
    if (membership.status === "rejected") return this.summary(membershipId);
    if (!canTransitionMembership(membership.status as MembershipStatus, "rejected")) {
      throw conflict("MEMBERSHIP_INVALID_TRANSITION", `Cannot reject a membership in status ${membership.status}.`);
    }
    await this.transition(membershipId, "rejected", { actorUserId: ownerUserId });
    return this.summary(membershipId);
  }

  private async assertOwner(membershipId: string, ownerUserId: string) {
    const membership = await this.getById(membershipId);
    if (!membership) throw notFound("MEMBERSHIP_NOT_FOUND", "Membership not found");
    const [gym] = await this.db
      .select({ ownerUserId: gymProfiles.ownerUserId, name: gymProfiles.name })
      .from(gymProfiles)
      .where(eq(gymProfiles.id, membership.gymId))
      .limit(1);
    if (!gym || gym.ownerUserId !== ownerUserId) {
      throw notFound("GYM_NOT_OWNER", "You do not manage this gym.");
    }
    return { membership, gym };
  }

  private async transition(
    membershipId: string,
    status: MembershipStatus,
    options: { actorUserId: string | null },
  ) {
    const now = new Date();
    const updates: Partial<typeof gymMemberships.$inferInsert> = {
      status,
      updatedAt: now,
    };
    if (status === "active") {
      const membership = await this.getById(membershipId);
      const startedAt = now;
      updates.startedAt = startedAt;
      updates.expiresAt = new Date(startedAt.getTime() + 30 * 86_400_000);
      // If the membership was already active, extend from the previous expiry.
      if (membership?.status === "active" && membership.expiresAt && membership.expiresAt > now) {
        updates.startedAt = membership.startedAt ?? startedAt;
        updates.expiresAt = new Date(membership.expiresAt.getTime() + 30 * 86_400_000);
      }
    }

    await this.db.update(gymMemberships).set(updates).where(eq(gymMemberships.id, membershipId));

    const requestStatus = status === "active" ? "approved" : status === "rejected" ? "rejected" : null;
    if (requestStatus) {
      await this.db
        .update(gymMembershipRequests)
        .set({ status: requestStatus, respondedAt: now, respondedByUserId: options.actorUserId, updatedAt: now })
        .where(eq(gymMembershipRequests.membershipId, membershipId));
    }

    const membership = await this.getById(membershipId);
    if (!membership) return;
    const [gym] = await this.db
      .select({ name: gymProfiles.name })
      .from(gymProfiles)
      .where(eq(gymProfiles.id, membership.gymId))
      .limit(1);

    if (status === "active") {
      await this.notifications.notify({
        userId: membership.fighterUserId,
        type: "MEMBERSHIP_APPROVED",
        title: "Membership approved",
        body: `Your membership at ${gym?.name ?? "the gym"} is now active.`,
        data: { membershipId, gymId: membership.gymId },
      });
      await this.audit.record({
        actorUserId: options.actorUserId,
        action: "MEMBERSHIP_ACTIVATED",
        entityType: "gym_membership",
        entityId: membershipId,
        metadata: { gymId: membership.gymId, fighterUserId: membership.fighterUserId },
      });
    } else if (status === "rejected") {
      await this.notifications.notify({
        userId: membership.fighterUserId,
        type: "MEMBERSHIP_REJECTED",
        title: "Membership request declined",
        body: `${gym?.name ?? "The gym"} declined your membership request. Any payment will be refunded.`,
        data: { membershipId, gymId: membership.gymId },
      });
      await this.audit.record({
        actorUserId: options.actorUserId,
        action: "MEMBERSHIP_REJECTED",
        entityType: "gym_membership",
        entityId: membershipId,
        metadata: { gymId: membership.gymId, fighterUserId: membership.fighterUserId },
      });
    }
  }

  /** Maintenance: mark active memberships past their expiry as expired. */
  async expireOverdue(now = new Date()): Promise<number> {
    const rows = await this.db
      .update(gymMemberships)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(gymMemberships.status, "active"), lt(gymMemberships.expiresAt, now)))
      .returning({ id: gymMemberships.id });
    return rows.length;
  }

  async summary(membershipId: string): Promise<GymMembershipSummary> {
    const [row] = await this.db
      .select({ membership: gymMemberships, gym: { id: gymProfiles.id, name: gymProfiles.name, city: gymProfiles.city } })
      .from(gymMemberships)
      .innerJoin(gymProfiles, eq(gymProfiles.id, gymMemberships.gymId))
      .where(eq(gymMemberships.id, membershipId))
      .limit(1);
    if (!row) throw notFound("MEMBERSHIP_NOT_FOUND", "Membership not found");
    return {
      id: row.membership.id,
      gymId: row.gym.id,
      gymName: row.gym.name,
      gymCity: row.gym.city,
      fighterUserId: row.membership.fighterUserId,
      amountPaise: row.membership.amountPaise,
      currency: row.membership.currency,
      status: row.membership.status as MembershipStatus,
      startedAt: row.membership.startedAt?.toISOString() ?? null,
      expiresAt: row.membership.expiresAt?.toISOString() ?? null,
      createdAt: row.membership.createdAt.toISOString(),
    };
  }

  async listForGym(
    gymId: string,
    params: { status?: string; cursor?: string; limit: number; pendingOnly?: boolean },
  ): Promise<Page<GymMembershipWithFighter>> {
    const cursor = decodeCursor(params.cursor);
    const conditions = [eq(gymMemberships.gymId, gymId)];
    if (params.status) conditions.push(eq(gymMemberships.status, params.status));
    if (params.pendingOnly) conditions.push(eq(gymMemberships.status, "paid_pending_approval"));
    if (cursor) conditions.push(sql`${gymMemberships.createdAt} < ${cursor.createdAt}`);

    const rows = await this.db
      .select({
        membership: gymMemberships,
        request: { status: gymMembershipRequests.status, createdAt: gymMembershipRequests.createdAt },
        fighter: {
          id: fighterProfiles.id,
          userId: fighterProfiles.userId,
          name: fighterProfiles.name,
          avatarUrl: fighterProfiles.avatarUrl,
          city: fighterProfiles.city,
          state: fighterProfiles.state,
          skillLevel: fighterProfiles.skillLevel,
          weightClass: fighterProfiles.weightClass,
          yearsExperience: fighterProfiles.yearsExperience,
          totalAmateurFights: fighterProfiles.totalAmateurFights,
          totalProFights: fighterProfiles.totalProFights,
          verificationStatus: fighterProfiles.verificationStatus,
        },
      })
      .from(gymMemberships)
      .leftJoin(gymMembershipRequests, eq(gymMembershipRequests.membershipId, gymMemberships.id))
      .leftJoin(fighterProfiles, eq(fighterProfiles.userId, gymMemberships.fighterUserId))
      .where(and(...conditions))
      .orderBy(desc(gymMemberships.createdAt), desc(gymMemberships.id))
      .limit(params.limit + 1);

    const page = buildPageWith(rows, params.limit, {
      createdAt: (row) => row.membership.createdAt,
      id: (row) => row.membership.id,
    });
    const disciplineMap = new Map<string, string[]>();
    const fighterIds = page.items.map((r) => r.fighter?.id).filter((id): id is string => Boolean(id));
    if (fighterIds.length > 0) {
      const disciplineRows = await this.db
        .select({ fighterId: fighterDisciplines.fighterId, discipline: fighterDisciplines.discipline })
        .from(fighterDisciplines)
        .where(inArray(fighterDisciplines.fighterId, fighterIds));
      for (const row of disciplineRows) {
        const list = disciplineMap.get(row.fighterId) ?? [];
        list.push(row.discipline);
        disciplineMap.set(row.fighterId, list);
      }
    }

    return {
      items: page.items.map((row) => {
        const summary: FighterSummary | null = row.fighter
          ? {
              id: row.fighter.id,
              userId: row.fighter.userId,
              name: row.fighter.name,
              avatarUrl: row.fighter.avatarUrl,
              city: row.fighter.city,
              state: row.fighter.state,
              skillLevel: row.fighter.skillLevel,
              weightClass: row.fighter.weightClass,
              disciplines: (disciplineMap.get(row.fighter.id) ?? []) as FighterSummary["disciplines"],
              yearsExperience: row.fighter.yearsExperience,
              totalAmateurFights: row.fighter.totalAmateurFights,
              totalProFights: row.fighter.totalProFights,
              isPremium: false,
              isVerified: row.fighter.verificationStatus === "verified",
            }
          : null;
        return {
          id: row.membership.id,
          gymId: row.membership.gymId,
          gymName: "",
          gymCity: "",
          fighterUserId: row.membership.fighterUserId,
          amountPaise: row.membership.amountPaise,
          currency: row.membership.currency,
          status: row.membership.status as MembershipStatus,
          startedAt: row.membership.startedAt?.toISOString() ?? null,
          expiresAt: row.membership.expiresAt?.toISOString() ?? null,
          createdAt: row.membership.createdAt.toISOString(),
          fighter: summary,
          requestStatus: (row.request?.status as GymMembershipWithFighter["requestStatus"]) ?? null,
          requestDate: row.request?.createdAt?.toISOString() ?? null,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }
}
