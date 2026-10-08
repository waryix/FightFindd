import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  fighterDisciplines,
  fighterProfiles,
  gymMembershipRequests,
  gymMemberships,
  gymProfiles,
  subscriptions,
  userBlocks,
  userReports,
  users,
} from "../../db/schema.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { boundingBoxSql, distanceKmSql, withinRadiusSql } from "../../lib/geo-sql.js";
import { buildSortPage, decodeSortCursor } from "../../lib/cursor.js";
import type {
  CreateFighterProfileInput,
  DiscoveryQuery,
  FighterCard,
  FighterMembershipView,
  FighterProfile,
  UpdateFighterProfileInput,
} from "@fightfind/types";
import { compatibilityScoreSql, matchLabelForScore } from "./compatibility.service.js";

type ProfileRow = typeof fighterProfiles.$inferSelect;

export class FighterService {
  constructor(private readonly db: Db) {}

  private async loadDisciplines(fighterIds: string[]): Promise<Map<string, string[]>> {
    if (fighterIds.length === 0) return new Map();
    const rows = await this.db
      .select({ fighterId: fighterDisciplines.fighterId, discipline: fighterDisciplines.discipline })
      .from(fighterDisciplines)
      .where(inArray(fighterDisciplines.fighterId, fighterIds));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.fighterId) ?? [];
      list.push(row.discipline);
      map.set(row.fighterId, list);
    }
    return map;
  }

  private async loadGymNames(gymIds: (string | null)[]): Promise<Map<string, string>> {
    const ids = gymIds.filter((id): id is string => Boolean(id));
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: gymProfiles.id, name: gymProfiles.name })
      .from(gymProfiles)
      .where(inArray(gymProfiles.id, ids));
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async mapProfile(
    row: ProfileRow,
    extras: { disciplines?: string[]; gymName?: string | null; distanceKm?: number | null; score?: number | null; premium?: boolean } = {},
  ): Promise<FighterProfile & { distanceKm: number | null; compatibilityScore: number | null; matchLabel: string | null }> {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      city: row.city,
      state: row.state,
      ageYears: row.ageYears,
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      yearsExperience: row.yearsExperience,
      totalAmateurFights: row.totalAmateurFights,
      totalProFights: row.totalProFights,
      bio: row.bio,
      disciplines: (extras.disciplines ?? []) as FighterProfile["disciplines"],
      skillLevel: row.skillLevel as FighterProfile["skillLevel"],
      weightClass: row.weightClass as FighterProfile["weightClass"],
      gymId: row.gymId,
      gymName: extras.gymName ?? null,
      avatarUrl: row.avatarUrl,
      latitude: row.latitude,
      longitude: row.longitude,
      verificationStatus: row.verificationStatus as FighterProfile["verificationStatus"],
      premiumStatus: extras.premium ?? false,
      isActive: row.lastActiveAt ? Date.now() - row.lastActiveAt.getTime() < 30 * 86_400_000 : false,
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      distanceKm: extras.distanceKm ?? null,
      compatibilityScore: extras.score ?? null,
      matchLabel: matchLabelForScore(extras.score),
    };
  }

  async getByUserId(userId: string): Promise<ProfileRow | null> {
    const [row] = await this.db.select().from(fighterProfiles).where(eq(fighterProfiles.userId, userId)).limit(1);
    return row ?? null;
  }

  async getById(profileId: string): Promise<ProfileRow | null> {
    const [row] = await this.db.select().from(fighterProfiles).where(eq(fighterProfiles.id, profileId)).limit(1);
    return row ?? null;
  }

  async getMyProfile(userId: string): Promise<FighterProfile | null> {
    const row = await this.getByUserId(userId);
    if (!row) return null;
    const [disciplines, gymNames] = await Promise.all([
      this.loadDisciplines([row.id]),
      this.loadGymNames([row.gymId]),
    ]);
    await this.db
      .update(fighterProfiles)
      .set({ lastActiveAt: new Date() })
      .where(eq(fighterProfiles.id, row.id))
      .catch(() => undefined);
    return this.mapProfile(row, {
      disciplines: disciplines.get(row.id) ?? [],
      gymName: row.gymId ? (gymNames.get(row.gymId) ?? null) : null,
    });
  }

  async getPublicProfile(
    profileId: string,
    viewer: { lat?: number; lng?: number } = {},
  ): Promise<FighterCard> {
    const [row] = await this.db
      .select()
      .from(fighterProfiles)
      .where(and(eq(fighterProfiles.id, profileId), eq(fighterProfiles.isPublic, true)))
      .limit(1);
    if (!row) throw notFound("FIGHTER_NOT_FOUND", "Fighter not found");

    const [disciplines, gymNames] = await Promise.all([
      this.loadDisciplines([row.id]),
      this.loadGymNames([row.gymId]),
    ]);
    const distance =
      viewer.lat !== undefined && viewer.lng !== undefined && row.latitude !== null && row.longitude !== null
        ? haversineKm(viewer.lat, viewer.lng, row.latitude, row.longitude)
        : null;

    const mapped = await this.mapProfile(row, {
      disciplines: disciplines.get(row.id) ?? [],
      gymName: row.gymId ? (gymNames.get(row.gymId) ?? null) : null,
      distanceKm: distance,
    });
    return mapped as FighterCard;
  }

  async createProfile(
    userId: string,
    input: CreateFighterProfileInput,
  ): Promise<FighterProfile> {
    const existing = await this.getByUserId(userId);
    if (existing) throw forbidden("CONFLICT", "You already have a fighter profile.");
    const [row] = await this.db
      .insert(fighterProfiles)
      .values({
        userId,
        name: input.name,
        city: input.city,
        state: input.state,
        ageYears: input.ageYears ?? null,
        heightCm: input.heightCm ?? null,
        weightKg: input.weightKg ?? null,
        yearsExperience: input.yearsExperience ?? 0,
        totalAmateurFights: input.totalAmateurFights ?? 0,
        totalProFights: input.totalProFights ?? 0,
        weightClass: input.weightClass,
        skillLevel: input.skillLevel,
        bio: input.bio ?? null,
        gymId: input.gymId ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        lastActiveAt: new Date(),
      })
      .returning();
    if (!row) throw new Error("Failed to create fighter profile");
    await this.replaceDisciplines(row.id, input.disciplines);
    return this.getMyProfile(userId) as Promise<FighterProfile>;
  }

  async updateProfile(userId: string, input: UpdateFighterProfileInput): Promise<FighterProfile> {
    const existing = await this.getByUserId(userId);
    if (!existing) throw notFound("FIGHTER_NOT_FOUND", "Create your fighter profile first.");
    const { disciplines, ...fields } = input;
    if (Object.keys(fields).length > 0) {
      await this.db
        .update(fighterProfiles)
        .set({
          ...fields,
          updatedAt: new Date(),
          lastActiveAt: new Date(),
        })
        .where(eq(fighterProfiles.id, existing.id));
    }
    if (disciplines) await this.replaceDisciplines(existing.id, disciplines);
    return this.getMyProfile(userId) as Promise<FighterProfile>;
  }

  private async replaceDisciplines(fighterId: string, disciplines: string[]) {
    await this.db.delete(fighterDisciplines).where(eq(fighterDisciplines.fighterId, fighterId));
    if (disciplines.length > 0) {
      await this.db
        .insert(fighterDisciplines)
        .values(disciplines.map((discipline) => ({ fighterId, discipline })));
    }
  }

  async setAvatar(userId: string, avatarUrl: string): Promise<void> {
    const existing = await this.getByUserId(userId);
    if (!existing) throw notFound("FIGHTER_NOT_FOUND", "Create your fighter profile first.");
    await this.db
      .update(fighterProfiles)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(fighterProfiles.id, existing.id));
  }

  async discover(
    viewerUserId: string | null,
    query: DiscoveryQuery,
  ): Promise<{ items: FighterCard[]; nextCursor: string | null }> {
    const viewerRow = viewerUserId ? await this.getByUserId(viewerUserId) : null;
    const viewerDisciplines = viewerRow
      ? ((await this.loadDisciplines([viewerRow.id])).get(viewerRow.id) ?? [])
      : [];

    const hasCoords = query.lat !== undefined && query.lng !== undefined;
    const distanceExpr = hasCoords
      ? distanceKmSql(fighterProfiles.latitude, fighterProfiles.longitude, query.lat!, query.lng!)
      : null;

    const scoreExpr = compatibilityScoreSql({
      viewerWeightClass: viewerRow?.weightClass ?? null,
      viewerSkillLevel: viewerRow?.skillLevel ?? null,
      viewerDisciplines,
      lat: query.lat,
      lng: query.lng,
      maxReferenceKm: query.radiusKm ?? 50,
    });

    let sortExpr: SQL<number>;
    let sortDirection: "asc" | "desc";
    let effectiveSort = query.sort;
    if (effectiveSort === "nearest" && !hasCoords) effectiveSort = "recently_active";
    switch (effectiveSort) {
      case "nearest":
        sortExpr = distanceExpr!;
        sortDirection = "asc";
        break;
      case "most_experienced":
        sortExpr = sql<number>`${fighterProfiles.yearsExperience}::float`;
        sortDirection = "desc";
        break;
      case "recently_active":
        sortExpr = sql<number>`coalesce(extract(epoch from ${fighterProfiles.lastActiveAt}), 0)::float`;
        sortDirection = "desc";
        break;
      default:
        sortExpr = scoreExpr;
        sortDirection = "desc";
        break;
    }

    const conditions: SQL[] = [
      eq(fighterProfiles.isPublic, true),
      eq(users.status, "active"),
      eq(users.isGuest, false),
    ];
    if (viewerRow) conditions.push(sql`${fighterProfiles.id} <> ${viewerRow.id}`);
    if (viewerUserId) {
      conditions.push(sql`not exists (
        select 1 from user_blocks ub
        where (ub.blocker_user_id = ${viewerUserId} and ub.blocked_user_id = ${fighterProfiles.userId})
           or (ub.blocker_user_id = ${fighterProfiles.userId} and ub.blocked_user_id = ${viewerUserId})
      )`);
    }

    if (hasCoords && query.radiusKm) {
      conditions.push(boundingBoxSql(fighterProfiles.latitude, fighterProfiles.longitude, query.lat!, query.lng!, query.radiusKm));
      conditions.push(withinRadiusSql(distanceExpr!, query.radiusKm));
    }
    if (query.city) conditions.push(sql`${fighterProfiles.city} ilike ${`%${query.city}%`}`);
    if (query.discipline) {
      conditions.push(sql`exists (
        select 1 from fighter_disciplines fd
        where fd.fighter_id = ${fighterProfiles.id} and fd.discipline = ${query.discipline}
      )`);
    }
    if (query.skill) conditions.push(eq(fighterProfiles.skillLevel, query.skill));
    if (query.weightClass) conditions.push(eq(fighterProfiles.weightClass, query.weightClass));
    if (query.minHeight !== undefined) conditions.push(sql`${fighterProfiles.heightCm} >= ${query.minHeight}`);
    if (query.maxHeight !== undefined) conditions.push(sql`${fighterProfiles.heightCm} <= ${query.maxHeight}`);
    if (query.minWeight !== undefined) conditions.push(sql`${fighterProfiles.weightKg} >= ${query.minWeight}`);
    if (query.maxWeight !== undefined) conditions.push(sql`${fighterProfiles.weightKg} <= ${query.maxWeight}`);
    if (query.minExperience !== undefined) {
      conditions.push(sql`${fighterProfiles.yearsExperience} >= ${query.minExperience}`);
    }
    if (query.maxExperience !== undefined) {
      conditions.push(sql`${fighterProfiles.yearsExperience} <= ${query.maxExperience}`);
    }
    if (query.minFights !== undefined) {
      conditions.push(
        sql`(${fighterProfiles.totalAmateurFights} + ${fighterProfiles.totalProFights}) >= ${query.minFights}`,
      );
    }
    if (query.maxFights !== undefined) {
      conditions.push(
        sql`(${fighterProfiles.totalAmateurFights} + ${fighterProfiles.totalProFights}) <= ${query.maxFights}`,
      );
    }
    if (query.search) {
      conditions.push(
        sql`(${fighterProfiles.name} ilike ${`%${query.search}%`} or ${fighterProfiles.city} ilike ${`%${query.search}%`})`,
      );
    }

    const cursor = decodeSortCursor(query.cursor);
    if (cursor) {
      const comparator = sortDirection === "desc" ? sql`<` : sql`>`;
      conditions.push(
        sql`((${sortExpr} ${comparator} ${cursor.value}) or (${sortExpr} = ${cursor.value} and ${fighterProfiles.id} < ${cursor.id}))`,
      );
    }

    const rows = await this.db
      .select({
        profile: fighterProfiles,
        distance: distanceExpr ? sql<number | null>`${distanceExpr}` : sql<number | null>`null`,
        score: sql<number>`${scoreExpr}`,
        sortValue: sql<number>`${sortExpr}`,
      })
      .from(fighterProfiles)
      .innerJoin(users, eq(users.id, fighterProfiles.userId))
      .where(and(...conditions))
      .orderBy(
        sortDirection === "asc" ? sql`${sortExpr} asc` : sql`${sortExpr} desc`,
        sql`${fighterProfiles.id} desc`,
      )
      .limit(query.limit + 1);

    const page = buildSortPage(
      rows,
      query.limit,
      (row) => Number(row.sortValue),
      (row) => row.profile.id,
    );
    const profileIds = page.items.map((r) => r.profile.id);
    const [disciplines, gymNames] = await Promise.all([
      this.loadDisciplines(profileIds),
      this.loadGymNames(page.items.map((r) => r.profile.gymId)),
    ]);

    const premiumUserIds = await this.loadPremiumUserIds(page.items.map((r) => r.profile.userId));

    const items = await Promise.all(
      page.items.map(async (row) =>
        ({
          ...(await this.mapProfile(row.profile, {
            disciplines: disciplines.get(row.profile.id) ?? [],
            gymName: row.profile.gymId ? (gymNames.get(row.profile.gymId) ?? null) : null,
            distanceKm: row.distance === null ? null : Number(row.distance),
            score: row.score === null ? null : Number(row.score),
            premium: premiumUserIds.has(row.profile.userId),
          })),
        }) as FighterCard),
    );

    return { items, nextCursor: page.nextCursor };
  }

  private async loadPremiumUserIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.db
      .selectDistinct({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.userId, userIds),
          eq(subscriptions.type, "FIGHTER_UPGRADE"),
          eq(subscriptions.status, "active"),
        ),
      );
    return new Set(rows.map((r) => r.userId));
  }

  async listMyMemberships(userId: string): Promise<FighterMembershipView[]> {
    const rows = await this.db
      .select({
        membership: gymMemberships,
        gym: {
          id: gymProfiles.id,
          name: gymProfiles.name,
          city: gymProfiles.city,
          coverPhotoUrl: gymProfiles.coverPhotoUrl,
        },
        requestStatus: gymMembershipRequests.status,
      })
      .from(gymMemberships)
      .innerJoin(gymProfiles, eq(gymProfiles.id, gymMemberships.gymId))
      .leftJoin(gymMembershipRequests, eq(gymMembershipRequests.membershipId, gymMemberships.id))
      .where(eq(gymMemberships.fighterUserId, userId))
      .orderBy(sql`${gymMemberships.createdAt} desc`);

    return rows.map((row) => ({
      id: row.membership.id,
      gym: row.gym,
      status: row.membership.status as FighterMembershipView["status"],
      requestStatus: (row.requestStatus as FighterMembershipView["requestStatus"]) ?? null,
      amountPaise: row.membership.amountPaise,
      startedAt: row.membership.startedAt?.toISOString() ?? null,
      expiresAt: row.membership.expiresAt?.toISOString() ?? null,
      createdAt: row.membership.createdAt.toISOString(),
    }));
  }

  async blockUser(blockerUserId: string, blockedUserId: string, reason?: string): Promise<void> {
    if (blockerUserId === blockedUserId) throw badRequest("VALIDATION_ERROR", "You cannot block yourself.");
    await this.db
      .insert(userBlocks)
      .values({ blockerUserId, blockedUserId, reason: reason ?? null })
      .onConflictDoNothing();
  }

  async unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
    await this.db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerUserId, blockerUserId), eq(userBlocks.blockedUserId, blockedUserId)));
  }

  async reportUser(
    reporterUserId: string,
    reportedUserId: string,
    reason: string,
    details?: string,
  ): Promise<void> {
    if (reporterUserId === reportedUserId) throw badRequest("VALIDATION_ERROR", "You cannot report yourself.");
    await this.db.insert(userReports).values({
      reporterUserId,
      reportedUserId,
      reason,
      details: details ?? null,
    });
  }

  async isBlocked(aUserId: string, bUserId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(
        sql`(blocker_user_id = ${aUserId} and blocked_user_id = ${bUserId})
         or (blocker_user_id = ${bUserId} and blocked_user_id = ${aUserId})`,
      )
      .limit(1);
    return Boolean(row);
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
