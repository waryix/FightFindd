import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { fighterDisciplines, fighterProfiles, sparringRequests } from "../../db/schema.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { buildPage, decodeCursor, type Page } from "../../lib/cursor.js";
import {
  canTransitionSparring,
  sparringTransitionActor,
} from "@fightfind/utils";
import type {
  CreateSparringRequestInput,
  FighterSummary,
  SparringRequest,
  SparringRequestStatus,
} from "@fightfind/types";
import type { NotificationService } from "../notifications/notifications.service.js";
import type { AuditService } from "../audit/audit.service.js";
import type { EntitlementsService } from "../entitlements/entitlements.service.js";
import type { FighterService } from "../fighters/fighters.service.js";

type RequestRow = typeof sparringRequests.$inferSelect;

export class SparringService {
  constructor(
    private readonly db: Db,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly fighters: FighterService,
  ) {}

  async createRequest(
    senderUserId: string,
    input: CreateSparringRequestInput,
  ): Promise<SparringRequest> {
    const receiverProfile = await this.fighters.getById(input.receiverId);
    if (!receiverProfile) throw notFound("FIGHTER_NOT_FOUND", "Fighter not found.");
    const receiverUserId = receiverProfile.userId;

    if (receiverUserId === senderUserId) {
      throw badRequest("CANNOT_REQUEST_SELF", "You cannot send a sparring request to yourself.");
    }

    if (await this.fighters.isBlocked(senderUserId, receiverUserId)) {
      throw conflict("FORBIDDEN", "You cannot send a request to this fighter.");
    }

    const proposedDate = new Date(input.proposedDate);
    if (proposedDate.getTime() < Date.now() - 60_000) {
      throw badRequest("VALIDATION_ERROR", "Choose a future date and time.");
    }

    const [duplicate] = await this.db
      .select({ id: sparringRequests.id })
      .from(sparringRequests)
      .where(
        and(
          eq(sparringRequests.status, "pending"),
          or(
            and(eq(sparringRequests.senderId, senderUserId), eq(sparringRequests.receiverId, receiverUserId)),
            and(eq(sparringRequests.senderId, receiverUserId), eq(sparringRequests.receiverId, senderUserId)),
          ),
        ),
      )
      .limit(1);
    if (duplicate) {
      throw conflict("DUPLICATE_REQUEST", "There is already a pending sparring request between you two.");
    }

    const entitlements = await this.entitlements.getForUser(senderUserId);
    if (entitlements.pendingRequestLimit !== null) {
      const [row] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(sparringRequests)
        .where(and(eq(sparringRequests.senderId, senderUserId), eq(sparringRequests.status, "pending")));
      if ((row?.count ?? 0) >= entitlements.pendingRequestLimit) {
        throw conflict(
          "REQUEST_LIMIT_REACHED",
          `Free accounts can have ${entitlements.pendingRequestLimit} pending requests. Upgrade to FightFind Pro for unlimited requests.`,
        );
      }
    }

    const [created] = await this.db
      .insert(sparringRequests)
      .values({
        senderId: senderUserId,
        receiverId: receiverUserId,
        discipline: input.discipline,
        proposedDate,
        proposedLocation: input.proposedLocation,
        message: input.message ?? null,
        status: "pending",
      })
      .returning();
    if (!created) throw new Error("Failed to create sparring request");

    const senderProfile = await this.fighters.getByUserId(senderUserId);
    await this.notifications.notify({
      userId: receiverUserId,
      type: "SPARRING_REQUEST_RECEIVED",
      title: "New sparring request",
      body: `${senderProfile?.name ?? "A fighter"} wants to spar with you.`,
      data: { matchId: created.id, senderId: senderUserId },
    });
    await this.audit.record({
      actorUserId: senderUserId,
      action: "SPARRING_REQUEST_CREATED",
      entityType: "sparring_request",
      entityId: created.id,
      metadata: { receiverId: receiverUserId, discipline: input.discipline },
    });

    return this.enrich(created);
  }

  async list(
    userId: string,
    params: { tab: "received" | "sent"; status?: SparringRequestStatus; cursor?: string; limit: number },
  ): Promise<Page<SparringRequest>> {
    const cursor = decodeCursor(params.cursor);
    const conditions = [
      params.tab === "received" ? eq(sparringRequests.receiverId, userId) : eq(sparringRequests.senderId, userId),
    ];
    if (params.status) conditions.push(eq(sparringRequests.status, params.status));
    if (cursor) conditions.push(sql`${sparringRequests.createdAt} < ${cursor.createdAt}`);

    const rows = await this.db
      .select()
      .from(sparringRequests)
      .where(and(...conditions))
      .orderBy(desc(sparringRequests.createdAt), desc(sparringRequests.id))
      .limit(params.limit + 1);

    const page = buildPage(rows, params.limit);
    const items = await Promise.all(page.items.map((row) => this.enrich(row)));
    return { items, nextCursor: page.nextCursor };
  }

  async getForParticipant(matchId: string, userId: string): Promise<SparringRequest> {
    const row = await this.getRaw(matchId);
    if (!row) throw notFound("MATCH_NOT_FOUND", "Match not found");
    if (row.senderId !== userId && row.receiverId !== userId) {
      throw notFound("MATCH_NOT_FOUND", "Match not found");
    }
    return this.enrich(row);
  }

  async getRaw(matchId: string): Promise<RequestRow | null> {
    const [row] = await this.db.select().from(sparringRequests).where(eq(sparringRequests.id, matchId)).limit(1);
    return row ?? null;
  }

  async updateStatus(
    matchId: string,
    userId: string,
    status: SparringRequestStatus,
  ): Promise<SparringRequest> {
    const row = await this.getRaw(matchId);
    if (!row) throw notFound("MATCH_NOT_FOUND", "Match not found");
    if (row.senderId !== userId && row.receiverId !== userId) {
      throw notFound("MATCH_NOT_FOUND", "Match not found");
    }
    if (!canTransitionSparring(row.status as SparringRequestStatus, status)) {
      throw conflict(
        "MATCH_INVALID_TRANSITION",
        `A ${row.status} request cannot be moved to ${status}.`,
      );
    }
    const requiredActor = sparringTransitionActor(status);
    if (requiredActor === "receiver" && row.receiverId !== userId) {
      throw conflict("FORBIDDEN", "Only the fighter who received the request can respond to it.");
    }

    const updated = await this.db
      .update(sparringRequests)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(sparringRequests.id, matchId), eq(sparringRequests.status, row.status)))
      .returning();
    if (updated.length === 0) {
      throw conflict("MATCH_INVALID_TRANSITION", "This request was already updated. Refresh and try again.");
    }

    const otherUserId = row.senderId === userId ? row.receiverId : row.senderId;
    const actorProfile = await this.fighters.getByUserId(userId);
    if (status === "accepted" || status === "declined") {
      await this.notifications.notify({
        userId: otherUserId,
        type: status === "accepted" ? "SPARRING_REQUEST_ACCEPTED" : "SPARRING_REQUEST_DECLINED",
        title: status === "accepted" ? "Sparring request accepted" : "Sparring request declined",
        body:
          status === "accepted"
            ? `${actorProfile?.name ?? "Your partner"} accepted your sparring request.`
            : `${actorProfile?.name ?? "The fighter"} declined your sparring request.`,
        data: { matchId, status },
      });
      await this.audit.record({
        actorUserId: userId,
        action: status === "accepted" ? "SPARRING_REQUEST_ACCEPTED" : "SPARRING_REQUEST_DECLINED",
        entityType: "sparring_request",
        entityId: matchId,
        metadata: { otherUserId },
      });
    } else {
      await this.audit.record({
        actorUserId: userId,
        action: `SPARRING_REQUEST_${status.toUpperCase()}`,
        entityType: "sparring_request",
        entityId: matchId,
        metadata: { otherUserId },
      });
    }

    return this.enrich(updated[0]!);
  }

  private async enrich(row: RequestRow): Promise<SparringRequest> {
    const profiles = await this.db
      .select()
      .from(fighterProfiles)
      .where(inArray(fighterProfiles.userId, [row.senderId, row.receiverId]));

    const disciplineRows =
      profiles.length > 0
        ? await this.db
            .select({ fighterId: fighterDisciplines.fighterId, discipline: fighterDisciplines.discipline })
            .from(fighterDisciplines)
            .where(inArray(fighterDisciplines.fighterId, profiles.map((p) => p.id)))
        : [];

    const disciplineMap = new Map<string, string[]>();
    for (const d of disciplineRows) {
      const list = disciplineMap.get(d.fighterId) ?? [];
      list.push(d.discipline);
      disciplineMap.set(d.fighterId, list);
    }

    const toSummary = (userId: string): FighterSummary | null => {
      const profile = profiles.find((p) => p.userId === userId);
      if (!profile) return null;
      return {
        id: profile.id,
        userId: profile.userId,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        city: profile.city,
        state: profile.state,
        skillLevel: profile.skillLevel,
        weightClass: profile.weightClass,
        disciplines: (disciplineMap.get(profile.id) ?? []) as FighterSummary["disciplines"],
        yearsExperience: profile.yearsExperience,
        totalAmateurFights: profile.totalAmateurFights,
        totalProFights: profile.totalProFights,
        isPremium: false,
        isVerified: profile.verificationStatus === "verified",
      };
    };

    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      sender: toSummary(row.senderId),
      receiver: toSummary(row.receiverId),
      discipline: row.discipline as SparringRequest["discipline"],
      proposedDate: row.proposedDate.toISOString(),
      proposedLocation: row.proposedLocation,
      message: row.message,
      status: row.status as SparringRequestStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
