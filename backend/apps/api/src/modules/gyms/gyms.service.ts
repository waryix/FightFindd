import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { gymDisciplines, gymProfiles } from "../../db/schema.js";
import { notFound } from "../../lib/errors.js";
import { boundingBoxSql, distanceKmSql, withinRadiusSql } from "../../lib/geo-sql.js";
import { buildSortPage, decodeSortCursor } from "../../lib/cursor.js";
import type { GymCard, GymDetail, GymDiscoveryQuery } from "@fightfind/types";

type GymRow = typeof gymProfiles.$inferSelect;

export class GymService {
  constructor(private readonly db: Db) {}

  private async loadDisciplines(gymIds: string[]): Promise<Map<string, string[]>> {
    if (gymIds.length === 0) return new Map();
    const rows = await this.db
      .select({ gymId: gymDisciplines.gymId, discipline: gymDisciplines.discipline })
      .from(gymDisciplines)
      .where(inArray(gymDisciplines.gymId, gymIds));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.gymId) ?? [];
      list.push(row.discipline);
      map.set(row.gymId, list);
    }
    return map;
  }

  mapGym(row: GymRow, disciplines: string[], distanceKm: number | null): GymDetail {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      address: row.address,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      latitude: row.latitude,
      longitude: row.longitude,
      disciplines: disciplines as GymCard["disciplines"],
      monthlyFeePaise: row.monthlyFeePaise,
      hasTrialClass: row.hasTrialClass,
      timings: row.timings,
      coverPhotoUrl: row.coverPhotoUrl,
      photoUrls: row.photoUrls,
      verificationStatus: row.verificationStatus as GymCard["verificationStatus"],
      isVerified: row.verificationStatus === "verified",
      status: row.status as GymCard["status"],
      distanceKm,
      ownerName: row.ownerName,
      phone: row.phone,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async discover(query: GymDiscoveryQuery): Promise<{ items: GymCard[]; nextCursor: string | null }> {
    const hasCoords = query.lat !== undefined && query.lng !== undefined;
    const distanceExpr = hasCoords
      ? distanceKmSql(gymProfiles.latitude, gymProfiles.longitude, query.lat!, query.lng!)
      : null;

    let effectiveSort = query.sort;
    // No rating system exists yet — never display fabricated ratings, so fall back.
    if (effectiveSort === "highest_rated") effectiveSort = "most_relevant";
    if (effectiveSort === "nearest" && !hasCoords) effectiveSort = "most_relevant";

    let sortExpr: SQL<number>;
    let sortDirection: "asc" | "desc";
    switch (effectiveSort) {
      case "nearest":
        sortExpr = distanceExpr!;
        sortDirection = "asc";
        break;
      case "lowest_fee":
        sortExpr = sql<number>`coalesce(${gymProfiles.monthlyFeePaise}, 2147483647)::float`;
        sortDirection = "asc";
        break;
      default:
        sortExpr = sql<number>`(
          case when ${gymProfiles.verificationStatus} = 'verified' then 1 else 0 end
          + case when ${gymProfiles.hasTrialClass} then 0.5 else 0 end
        )::float`;
        sortDirection = "desc";
        break;
    }

    // Public discovery only shows fully listed gyms.
    const conditions: SQL[] = [eq(gymProfiles.status, "active")];

    if (hasCoords && query.radiusKm) {
      conditions.push(boundingBoxSql(gymProfiles.latitude, gymProfiles.longitude, query.lat!, query.lng!, query.radiusKm));
      conditions.push(withinRadiusSql(distanceExpr!, query.radiusKm));
    }
    if (query.city) conditions.push(sql`${gymProfiles.city} ilike ${`%${query.city}%`}`);
    if (query.discipline) {
      conditions.push(sql`exists (
        select 1 from gym_disciplines gd
        where gd.gym_id = ${gymProfiles.id} and gd.discipline = ${query.discipline}
      )`);
    }
    if (query.maxFeePaise !== undefined) conditions.push(sql`${gymProfiles.monthlyFeePaise} <= ${query.maxFeePaise}`);
    if (query.minFeePaise !== undefined) conditions.push(sql`${gymProfiles.monthlyFeePaise} >= ${query.minFeePaise}`);
    if (query.hasTrial) conditions.push(eq(gymProfiles.hasTrialClass, true));
    if (query.verifiedOnly) conditions.push(eq(gymProfiles.verificationStatus, "verified"));
    if (query.search) {
      conditions.push(
        sql`(${gymProfiles.name} ilike ${`%${query.search}%`} or ${gymProfiles.city} ilike ${`%${query.search}%`} or ${gymProfiles.address} ilike ${`%${query.search}%`})`,
      );
    }

    const cursor = decodeSortCursor(query.cursor);
    if (cursor) {
      const comparator = sortDirection === "desc" ? sql`<` : sql`>`;
      conditions.push(
        sql`((${sortExpr} ${comparator} ${cursor.value}) or (${sortExpr} = ${cursor.value} and ${gymProfiles.id} < ${cursor.id}))`,
      );
    }

    const rows = await this.db
      .select({
        gym: gymProfiles,
        distance: distanceExpr ? sql<number | null>`${distanceExpr}` : sql<number | null>`null`,
        sortValue: sql<number>`${sortExpr}`,
      })
      .from(gymProfiles)
      .where(and(...conditions))
      .orderBy(
        sortDirection === "asc" ? sql`${sortExpr} asc` : sql`${sortExpr} desc`,
        sql`${gymProfiles.id} desc`,
      )
      .limit(query.limit + 1);

    const page = buildSortPage(
      rows,
      query.limit,
      (row) => Number(row.sortValue),
      (row) => row.gym.id,
    );
    const disciplines = await this.loadDisciplines(page.items.map((r) => r.gym.id));

    return {
      items: page.items.map(
        (row) =>
          this.mapGym(
            row.gym,
            disciplines.get(row.gym.id) ?? [],
            row.distance === null ? null : Number(row.distance),
          ) as GymCard,
      ),
      nextCursor: page.nextCursor,
    };
  }

  /** Public detail — only fully listed, non-suspended gyms are visible. */
  async getPublicGym(
    gymId: string,
    viewer: { lat?: number; lng?: number } = {},
  ): Promise<GymDetail> {
    const [row] = await this.db
      .select()
      .from(gymProfiles)
      .where(and(eq(gymProfiles.id, gymId), eq(gymProfiles.status, "active")))
      .limit(1);
    if (!row) throw notFound("GYM_NOT_FOUND", "Gym not found");
    const disciplines = await this.loadDisciplines([row.id]);
    const distance =
      viewer.lat !== undefined && viewer.lng !== undefined && row.latitude !== null && row.longitude !== null
        ? haversine(viewer.lat, viewer.lng, row.latitude, row.longitude)
        : null;
    return this.mapGym(row, disciplines.get(row.id) ?? [], distance);
  }

  async getById(gymId: string): Promise<GymRow | null> {
    const [row] = await this.db.select().from(gymProfiles).where(eq(gymProfiles.id, gymId)).limit(1);
    return row ?? null;
  }

  async getDisciplinesFor(gymId: string): Promise<string[]> {
    return (await this.loadDisciplines([gymId])).get(gymId) ?? [];
  }

  async replaceDisciplines(gymId: string, disciplines: string[]) {
    await this.db.delete(gymDisciplines).where(eq(gymDisciplines.gymId, gymId));
    if (disciplines.length > 0) {
      await this.db.insert(gymDisciplines).values(disciplines.map((discipline) => ({ gymId, discipline })));
    }
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
