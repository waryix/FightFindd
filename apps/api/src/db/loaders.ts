import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../config/db";
import {
  deviceTokens,
  fighterDisciplines,
  fighterProfiles,
  gymProfiles,
  gymDisciplines,
  payments,
  subscriptions,
  users,
} from "./schema";
import { mapFighter, mapGym } from "./mappers";

export async function hydrateFighters(userRows: any[]) {
  const rows = userRows.filter(Boolean);
  if (rows.length === 0) return [];

  const userIds = rows.map((u) => u.id);

  const profiles = await db
    .select()
    .from(fighterProfiles)
    .where(inArray(fighterProfiles.userId, userIds));
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const profileIds = profiles.map((p) => p.id);

  const disciplines = profileIds.length
    ? await db
        .select()
        .from(fighterDisciplines)
        .where(inArray(fighterDisciplines.fighterId, profileIds))
    : [];
  const discByProfile = new Map<string, string[]>();
  for (const d of disciplines) {
    const list = discByProfile.get(d.fighterId) ?? [];
    list.push(d.discipline);
    discByProfile.set(d.fighterId, list);
  }

  const tokens = await db
    .select()
    .from(deviceTokens)
    .where(inArray(deviceTokens.userId, userIds))
    .orderBy(desc(deviceTokens.createdAt));
  const tokenByUser = new Map<string, string>();
  for (const t of tokens) {
    if (!tokenByUser.has(t.userId)) tokenByUser.set(t.userId, t.token);
  }

  const fighterSubs = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.userId, userIds),
        eq(subscriptions.type, "fighter_monthly"),
        eq(subscriptions.status, "active")
      )
    );
  const now = Date.now();
  const subEndByUser = new Map<string, string | null>();
  for (const s of fighterSubs) {
    const end = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).getTime() : null;
    if (end !== null && end <= now) continue;
    if (!subEndByUser.has(s.userId)) {
      subEndByUser.set(s.userId, s.currentPeriodEnd ?? null);
    }
  }

  return rows.map((user) => {
    const profile = profileByUser.get(user.id) ?? null;
    return mapFighter({
      user,
      profile,
      disciplines: profile ? discByProfile.get(profile.id) ?? [] : [],
      pushToken: tokenByUser.get(user.id) ?? null,
      isPro: subEndByUser.has(user.id),
      subscriptionUntil: subEndByUser.get(user.id) ?? null,
    });
  });
}

export async function getFighterById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (rows.length === 0) return null;
  const [fighter] = await hydrateFighters(rows);
  return fighter;
}

export async function getFighterByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length === 0) return null;
  const [fighter] = await hydrateFighters(rows);
  return fighter;
}

export async function getFighterByPhone(phone: string) {
  const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (rows.length === 0) return null;
  const [fighter] = await hydrateFighters(rows);
  return fighter;
}

export async function hydrateGyms(gymRows: any[]) {
  const rows = gymRows.filter(Boolean);
  if (rows.length === 0) return [];

  const gymIds = rows.map((g) => g.id);
  const ownerIds = [...new Set(rows.map((g) => g.ownerUserId))];

  const disciplines = await db
    .select()
    .from(gymDisciplines)
    .where(inArray(gymDisciplines.gymId, gymIds));
  const discByGym = new Map<string, string[]>();
  for (const d of disciplines) {
    const list = discByGym.get(d.gymId) ?? [];
    list.push(d.discipline);
    discByGym.set(d.gymId, list);
  }

  const owners = ownerIds.length
    ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, ownerIds))
    : [];
  const emailByUser = new Map(owners.map((o) => [o.id, o.email]));

  const gymPayments = await db
    .select()
    .from(payments)
    .where(inArray(payments.gymId, gymIds))
    .orderBy(desc(payments.createdAt));
  const lastPaymentByGym = new Map<string, any>();
  for (const p of gymPayments) {
    if (p.gymId && !lastPaymentByGym.has(p.gymId)) lastPaymentByGym.set(p.gymId, p);
  }

  const gymSubs = await db
    .select()
    .from(subscriptions)
    .where(inArray(subscriptions.gymId, gymIds))
    .orderBy(desc(subscriptions.createdAt));
  const activeSubByGym = new Map<string, any>();
  const now = Date.now();
  for (const s of gymSubs) {
    const end = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).getTime() : null;
    if (
      s.gymId &&
      s.status === "active" &&
      (end === null || end > now) &&
      !activeSubByGym.has(s.gymId)
    ) {
      activeSubByGym.set(s.gymId, s);
    }
  }

  return rows.map((gym) => {
    const sub = activeSubByGym.get(gym.id);
    const lastPayment = lastPaymentByGym.get(gym.id);
    return mapGym({
      gym,
      disciplines: discByGym.get(gym.id) ?? [],
      ownerEmail: emailByUser.get(gym.ownerUserId) ?? null,
      registrationPaid: Boolean(gym.listingFeePaymentId),
      paymentId: lastPayment?.providerPaymentId ?? null,
      monthlyStatus: sub ? "active" : "inactive",
      nextBillingAt: sub?.currentPeriodEnd ?? null,
    });
  });
}

export async function getGymById(id: string) {
  const rows = await db.select().from(gymProfiles).where(eq(gymProfiles.id, id)).limit(1);
  if (rows.length === 0) return null;
  const [gym] = await hydrateGyms(rows);
  return gym;
}

export async function getGymRowById(id: string) {
  const rows = await db.select().from(gymProfiles).where(eq(gymProfiles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getFightersByUserIds(ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const rows = await db.select().from(users).where(inArray(users.id, unique));
  return hydrateFighters(rows);
}

export async function getFighterIdByEmail(email: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function findGymsForOwner(userId: string) {
  const rows = await db
    .select()
    .from(gymProfiles)
    .where(eq(gymProfiles.ownerUserId, userId))
    .orderBy(desc(gymProfiles.createdAt));
  return hydrateGyms(rows);
}

export { or };
