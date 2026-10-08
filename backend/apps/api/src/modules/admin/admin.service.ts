import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  auditLogs,
  fighterProfiles,
  gymMemberships,
  gymProfiles,
  gymVerification,
  payments,
  userRoles,
  users,
} from "../../db/schema.js";
import { conflict, notFound } from "../../lib/errors.js";
import { buildPage, buildPageWith, decodeCursor, type Page } from "../../lib/cursor.js";
import type { AdminUserRecord, GymDetail } from "@fightfind/types";
import type { GymService } from "../gyms/gyms.service.js";
import type { AuditService } from "../audit/audit.service.js";
import type { NotificationService } from "../notifications/notifications.service.js";
import type { MembershipService } from "../gyms/membership.service.js";
import type { SubscriptionsService } from "../payments/subscriptions.service.js";

export class AdminService {
  constructor(
    private readonly db: Db,
    private readonly gyms: GymService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly memberships: MembershipService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async listGyms(params: {
    q?: string;
    status?: string;
    cursor?: string;
    limit: number;
  }): Promise<Page<GymDetail>> {
    const cursor = decodeCursor(params.cursor);
    const conditions = [];
    if (params.q) {
      conditions.push(or(ilike(gymProfiles.name, `%${params.q}%`), ilike(gymProfiles.city, `%${params.q}%`)));
    }
    if (params.status) conditions.push(eq(gymProfiles.status, params.status));
    if (cursor) conditions.push(sql`${gymProfiles.createdAt} < ${cursor.createdAt}`);

    const rows = await this.db
      .select()
      .from(gymProfiles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(gymProfiles.createdAt), desc(gymProfiles.id))
      .limit(params.limit + 1);

    const page = buildPage(rows, params.limit);
    const items = await Promise.all(
      page.items.map(async (row) => this.gyms.mapGym(row, await this.gyms.getDisciplinesFor(row.id), null) as GymDetail),
    );
    return { items, nextCursor: page.nextCursor };
  }

  async verifyGym(
    adminUserId: string,
    gymId: string,
    input: { status: "pending" | "verified" | "rejected" | "suspended"; reason?: string },
  ): Promise<GymDetail> {
    const gym = await this.gyms.getById(gymId);
    if (!gym) throw notFound("GYM_NOT_FOUND", "Gym not found");
    if (gym.status === "draft" && input.status === "verified") {
      throw conflict("CONFLICT", "This gym has not completed onboarding.");
    }

    const now = new Date();
    const gymStatus =
      input.status === "verified"
        ? "active"
        : input.status === "suspended"
          ? "suspended"
          : input.status === "rejected"
            ? "verification_rejected"
            : gym.status;

    await this.db
      .update(gymProfiles)
      .set({
        verificationStatus: input.status,
        status: gymStatus,
        verifiedAt: input.status === "verified" ? now : gym.verifiedAt,
        listedAt: input.status === "verified" ? (gym.listedAt ?? now) : gym.listedAt,
        updatedAt: now,
      })
      .where(eq(gymProfiles.id, gym.id));

    await this.db.insert(gymVerification).values({
      gymId: gym.id,
      status: input.status,
      reason: input.reason ?? null,
      reviewedByUserId: adminUserId,
    });

    const action =
      input.status === "verified"
        ? "GYM_VERIFIED"
        : input.status === "rejected"
          ? "GYM_VERIFICATION_REJECTED"
          : input.status === "suspended"
            ? "GYM_SUSPENDED"
            : "GYM_VERIFICATION_UPDATED";

    await this.audit.record({
      actorUserId: adminUserId,
      action,
      entityType: "gym_profile",
      entityId: gym.id,
      metadata: { status: input.status, reason: input.reason ?? null },
    });

    if (input.status === "verified") {
      await this.notifications.notify({
        userId: gym.ownerUserId,
        type: "LISTING_VERIFIED",
        title: "Gym listing verified",
        body: `${gym.name} is now live on FightFind.`,
        data: { gymId: gym.id },
      });
    } else if (input.status === "rejected" || input.status === "suspended") {
      await this.notifications.notify({
        userId: gym.ownerUserId,
        type: "SYSTEM",
        title: input.status === "rejected" ? "Gym verification rejected" : "Gym listing suspended",
        body:
          input.status === "rejected"
            ? `${gym.name} was not verified. Reason: ${input.reason ?? "not provided"}.`
            : `${gym.name} has been suspended. Contact FightFind support.`,
        data: { gymId: gym.id },
      });
    }

    const updated = await this.gyms.getById(gym.id);
    return this.gyms.mapGym(updated!, await this.gyms.getDisciplinesFor(gym.id), null) as GymDetail;
  }

  async listUsers(params: { q?: string; cursor?: string; limit: number }): Promise<Page<AdminUserRecord>> {
    const cursor = decodeCursor(params.cursor);
    const conditions = [];
    if (params.q) {
      conditions.push(
        or(ilike(users.name, `%${params.q}%`), ilike(users.phone, `%${params.q}%`), ilike(users.email, `%${params.q}%`)),
      );
    }
    if (cursor) conditions.push(sql`${users.createdAt} < ${cursor.createdAt}`);

    const rows = await this.db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(params.limit + 1);

    const page = buildPage(rows, params.limit);
    const ids = page.items.map((u) => u.id);
    const roleRows =
      ids.length > 0
        ? await this.db
            .select({ userId: userRoles.userId, role: userRoles.role })
            .from(userRoles)
            .where(inArray(userRoles.userId, ids))
        : [];
    const roleMap = new Map<string, string[]>();
    for (const row of roleRows) {
      const list = roleMap.get(row.userId) ?? [];
      list.push(row.role);
      roleMap.set(row.userId, list);
    }

    return {
      items: page.items.map((user) => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        roles: (roleMap.get(user.id) ?? []) as AdminUserRecord["roles"],
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async listPayments(params: {
    status?: string;
    failedOnly?: boolean;
    cursor?: string;
    limit: number;
  }) {
    const cursor = decodeCursor(params.cursor);
    const conditions = [];
    if (params.failedOnly) conditions.push(eq(payments.status, "failed"));
    else if (params.status) conditions.push(eq(payments.status, params.status));
    if (cursor) conditions.push(sql`${payments.createdAt} < ${cursor.createdAt}`);

    const rows = await this.db
      .select()
      .from(payments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payments.createdAt), desc(payments.id))
      .limit(params.limit + 1);

    const page = buildPage(rows, params.limit);
    return {
      items: page.items.map((row) => ({
        id: row.id,
        userId: row.userId,
        gymId: row.gymId,
        fighterId: row.fighterUserId,
        type: row.type as never,
        amountPaise: row.amountPaise,
        currency: row.currency,
        provider: row.provider,
        providerOrderId: row.providerOrderId,
        providerPaymentId: row.providerPaymentId,
        providerSubscriptionId: row.providerSubscriptionId,
        status: row.status as never,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async listMemberships(params: { status?: string; gymId?: string; cursor?: string; limit: number }) {
    const cursor = decodeCursor(params.cursor);
    const conditions = [];
    if (params.status) conditions.push(eq(gymMemberships.status, params.status));
    if (params.gymId) conditions.push(eq(gymMemberships.gymId, params.gymId));
    if (cursor) conditions.push(sql`${gymMemberships.createdAt} < ${cursor.createdAt}`);

    const rows = await this.db
      .select({
        membership: gymMemberships,
        gymName: gymProfiles.name,
        fighterName: fighterProfiles.name,
      })
      .from(gymMemberships)
      .innerJoin(gymProfiles, eq(gymProfiles.id, gymMemberships.gymId))
      .leftJoin(fighterProfiles, eq(fighterProfiles.userId, gymMemberships.fighterUserId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(gymMemberships.createdAt), desc(gymMemberships.id))
      .limit(params.limit + 1);

    const page = buildPageWith(rows, params.limit, {
      createdAt: (row) => row.membership.createdAt,
      id: (row) => row.membership.id,
    });
    return {
      items: page.items.map((row) => ({
        id: row.membership.id,
        gymId: row.membership.gymId,
        gymName: row.gymName,
        gymCity: "",
        fighterUserId: row.membership.fighterUserId,
        fighterName: row.fighterName ?? undefined,
        amountPaise: row.membership.amountPaise,
        currency: row.membership.currency,
        status: row.membership.status as never,
        startedAt: row.membership.startedAt?.toISOString() ?? null,
        expiresAt: row.membership.expiresAt?.toISOString() ?? null,
        createdAt: row.membership.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async listAuditLogs(params: { cursor?: string; limit: number }) {
    const cursor = decodeCursor(params.cursor);
    const conditions = [];
    if (cursor) conditions.push(sql`${auditLogs.createdAt} < ${cursor.createdAt}`);
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(params.limit + 1);
    const page = buildPage(rows, params.limit);
    return {
      items: page.items.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async runMaintenance() {
    const expiredMemberships = await this.memberships.expireOverdue();
    const suspendedGyms = await this.subscriptions.enforceGymSuspensions();
    return { expiredMemberships, suspendedGyms };
  }
}
