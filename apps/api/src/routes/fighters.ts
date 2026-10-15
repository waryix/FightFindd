import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { db } from "../config/db";
import { deviceTokens, fighterDisciplines, fighterProfiles, users } from "../db/schema";
import {
  getFighterByEmail,
  getFighterById,
  getFighterByPhone,
  hydrateFighters,
} from "../db/loaders";
import { requireAuth } from "../middleware/auth";

export const fighterRouter: IRouter = Router();

const PROFILE_FIELDS: Record<string, string> = {
  city: "city",
  state: "state",
  latitude: "latitude",
  longitude: "longitude",
  skill_level: "skillLevel",
  skillLevel: "skillLevel",
  weight_class: "weightClass",
  weightClass: "weightClass",
  age_years: "ageYears",
  ageYears: "ageYears",
  years_experience: "yearsExperience",
  yearsExperience: "yearsExperience",
  height_cm: "heightCm",
  heightCm: "heightCm",
  weight_kg: "weightKg",
  weightKg: "weightKg",
  total_amateur_fights: "totalAmateurFights",
  totalAmateurFights: "totalAmateurFights",
  total_pro_fights: "totalProFights",
  totalProFights: "totalProFights",
  bio: "bio",
  avatar_url: "avatarUrl",
  avatarUrl: "avatarUrl",
  gym_id: "gymId",
  gymId: "gymId",
};

fighterRouter.get("/", async (req, res) => {
  const {
    city, skill_level, weight_class, discipline, exclude_id,
    lat, lng, radius_km, min_experience, max_experience,
    min_weight, max_weight, min_height, max_height,
    min_fights, max_fights, search,
  } = req.query;

  try {
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(fighterProfiles.name, `%${search}%`),
          ilike(fighterProfiles.city, `%${search}%`)
        )
      );
    }
    if (city) conditions.push(ilike(fighterProfiles.city, `%${city}%`));
    if (skill_level) conditions.push(eq(fighterProfiles.skillLevel, String(skill_level)));
    if (weight_class) conditions.push(eq(fighterProfiles.weightClass, String(weight_class)));
    if (exclude_id) conditions.push(ne(users.id, String(exclude_id)));

    if (discipline) {
      const rows = await db
        .select({ id: fighterDisciplines.fighterId })
        .from(fighterDisciplines)
        .where(eq(fighterDisciplines.discipline, String(discipline)));
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) {
        res.json({ fighters: [], count: 0 });
        return;
      }
      conditions.push(inArray(fighterProfiles.id, ids));
    }

    const rows = await db
      .select({ user: users })
      .from(fighterProfiles)
      .innerJoin(users, eq(fighterProfiles.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(fighterProfiles.createdAt));

    let fighters = await hydrateFighters(rows.map((r) => r.user));

    const num = (v: unknown) => (v == null ? null : Number(v));
    const minExp = num(min_experience);
    const maxExp = num(max_experience);
    const minW = num(min_weight);
    const maxW = num(max_weight);
    const minH = num(min_height);
    const maxH = num(max_height);
    const minF = num(min_fights);
    const maxF = num(max_fights);

    fighters = fighters.filter((f) => {
      if (minExp != null && f.years_experience < minExp) return false;
      if (maxExp != null && f.years_experience > maxExp) return false;
      if (minW != null && (f.weight_kg == null || f.weight_kg < minW)) return false;
      if (maxW != null && (f.weight_kg == null || f.weight_kg > maxW)) return false;
      if (minH != null && (f.height_cm == null || f.height_cm < minH)) return false;
      if (maxH != null && (f.height_cm == null || f.height_cm > maxH)) return false;
      if (minF != null && Math.max(f.total_amateur_fights, f.total_pro_fights) < minF) return false;
      if (maxF != null && Math.min(f.total_amateur_fights, f.total_pro_fights) > maxF) return false;
      return true;
    });

    if (lat && lng && radius_km) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const radius = parseFloat(radius_km as string);
      fighters = fighters.filter((f) => {
        if (f.latitude == null || f.longitude == null) return false;
        const R = 6371;
        const dLat = ((f.latitude - userLat) * Math.PI) / 180;
        const dLon = ((f.longitude - userLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((userLat * Math.PI) / 180) *
            Math.cos((f.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radius;
      });
    }

    res.json({ fighters, count: fighters.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

fighterRouter.get("/phone/:phone", async (req, res) => {
  try {
    const fighter = await getFighterByPhone(decodeURIComponent(req.params.phone));
    if (!fighter) { res.status(404).json({ fighter: null }); return; }
    res.json({ fighter });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

fighterRouter.get("/email/:email", async (req, res) => {
  try {
    const fighter = await getFighterByEmail(decodeURIComponent(req.params.email));
    if (!fighter) { res.status(404).json({ fighter: null }); return; }
    res.json({ fighter });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

fighterRouter.get("/:id", async (req, res) => {
  try {
    const fighter = await getFighterById(req.params.id);
    if (!fighter) { res.status(404).json({ error: "Fighter not found" }); return; }
    res.json({ fighter });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

fighterRouter.post("/", requireAuth, async (req, res) => {
  const body = req.body as any;
  const userId = (req as any).user.id as string;

  try {
    const userUpdate: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (body.name != null) userUpdate.name = body.name;
    if (body.phone != null) userUpdate.phone = body.phone;
    await db.update(users).set(userUpdate).where(eq(users.id, userId));

    const values = {
      name: body.name ?? "Fighter",
      city: body.city ?? "",
      state: body.state ?? "",
      latitude: body.latitude ?? 12.9716,
      longitude: body.longitude ?? 77.5946,
      skillLevel: body.skillLevel ?? body.skill_level ?? "",
      weightClass: body.weightClass ?? body.weight_class ?? "",
      ageYears: body.ageYears ?? body.age_years ?? 0,
      yearsExperience: body.yearsExperience ?? body.years_experience ?? 0,
      heightCm: body.heightCm ?? body.height_cm ?? null,
      weightKg: body.weightKg ?? body.weight_kg ?? null,
      totalAmateurFights: body.totalAmateurFights ?? body.total_amateur_fights ?? 0,
      totalProFights: body.totalProFights ?? body.total_pro_fights ?? 0,
      bio: body.bio ?? null,
      avatarUrl: body.avatarUrl ?? body.avatar_url ?? null,
    };

    const existing = (
      await db
        .select()
        .from(fighterProfiles)
        .where(eq(fighterProfiles.userId, userId))
        .limit(1)
    )[0];

    const profile = existing
      ? (
          await db
            .update(fighterProfiles)
            .set({ ...values, updatedAt: new Date().toISOString() })
            .where(eq(fighterProfiles.id, existing.id))
            .returning()
        )[0]!
      : (await db.insert(fighterProfiles).values({ userId, ...values }).returning())[0]!;

    const disciplines: string[] = body.discipline ?? body.disciplines ?? [];
    await db.delete(fighterDisciplines).where(eq(fighterDisciplines.fighterId, profile.id));
    if (Array.isArray(disciplines) && disciplines.length) {
      await db
        .insert(fighterDisciplines)
        .values(disciplines.map((d) => ({ fighterId: profile.id, discipline: String(d) })))
        .onConflictDoNothing();
    }

    const fighter = await getFighterById(userId);
    res.status(existing ? 200 : 201).json({ fighter });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fighterRouter.patch("/:id", async (req, res) => {
  const body = req.body as Record<string, any>;
  const userId = req.params.id;

  try {
    const userUpdate: Record<string, any> = {};
    if ("name" in body) userUpdate.name = body.name;
    if ("phone" in body) userUpdate.phone = body.phone;
    if ("email" in body) userUpdate.email = body.email;
    if (Object.keys(userUpdate).length) {
      userUpdate.updatedAt = new Date().toISOString();
      await db.update(users).set(userUpdate).where(eq(users.id, userId));
    }

    let profile = (
      await db.select().from(fighterProfiles).where(eq(fighterProfiles.userId, userId)).limit(1)
    )[0];

    const profileUpdate: Record<string, any> = {};
    for (const [key, column] of Object.entries(PROFILE_FIELDS)) {
      if (key in body) profileUpdate[column] = body[key];
    }
    if ("name" in body) profileUpdate.name = body.name;

    if (Object.keys(profileUpdate).length) {
      if (profile) {
        profileUpdate.updatedAt = new Date().toISOString();
        await db
          .update(fighterProfiles)
          .set(profileUpdate)
          .where(eq(fighterProfiles.id, profile.id));
      } else {
        const created = await db
          .insert(fighterProfiles)
          .values({
            userId,
            name: profileUpdate.name ?? "Fighter",
            city: profileUpdate.city ?? "",
            state: profileUpdate.state ?? "",
            weightClass: profileUpdate.weightClass ?? "",
            skillLevel: profileUpdate.skillLevel ?? "",
            ...profileUpdate,
          })
          .returning();
        profile = created[0]!;
      }
    }

    if ("discipline" in body && profile) {
      const disciplines: string[] = body.discipline ?? [];
      await db.delete(fighterDisciplines).where(eq(fighterDisciplines.fighterId, profile.id));
      if (Array.isArray(disciplines) && disciplines.length) {
        await db
          .insert(fighterDisciplines)
          .values(disciplines.map((d) => ({ fighterId: profile!.id, discipline: String(d) })))
          .onConflictDoNothing();
      }
    }

    if ("push_token" in body && body.push_token) {
      await db
        .insert(deviceTokens)
        .values({ userId, token: body.push_token, platform: "unknown", lastSeenAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: deviceTokens.token,
          set: { userId, lastSeenAt: new Date().toISOString() },
        });
    }

    const fighter = await getFighterById(userId);
    if (!fighter) { res.status(404).json({ error: "Fighter not found" }); return; }
    res.json({ fighter });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
