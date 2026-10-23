import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../config/db";
import { gymDisciplines, gymOwners, gymProfiles, payments } from "../db/schema";
import { getGymById, getGymRowById, hydrateGyms, findGymsForOwner } from "../db/loaders";
import { requireAuth, requireNotGuest } from "../middleware/auth";

export const gymRouter: IRouter = Router();

function requireGymOwner(req: Request, res: Response, next: NextFunction) {
  const id = (req as any).user?.id;
  if (!id) {
    res.status(401).json({ error: "Missing gym owner account." });
    return;
  }
  next();
}

gymRouter.get("/", async (req, res) => {
  const { city, discipline, lat, lng, radius_km, search, has_trial } = req.query;

  try {
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(gymProfiles.name, `%${search}%`),
          ilike(gymProfiles.city, `%${search}%`),
          ilike(gymProfiles.address, `%${search}%`)
        )
      );
    }
    if (city) conditions.push(ilike(gymProfiles.city, `%${city}%`));
    if (has_trial === "true") conditions.push(eq(gymProfiles.hasTrialClass, true));

    if (discipline) {
      const rows = await db
        .select({ id: gymDisciplines.gymId })
        .from(gymDisciplines)
        .where(eq(gymDisciplines.discipline, String(discipline)));
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) {
        res.json({ gyms: [], count: 0 });
        return;
      }
      conditions.push(inArray(gymProfiles.id, ids));
    }

    const rows = await db
      .select()
      .from(gymProfiles)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(gymProfiles.createdAt));

    let gyms = await hydrateGyms(rows);

    if (lat && lng && radius_km) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const radius = parseFloat(radius_km as string);
      gyms = gyms.filter((g) => {
        if (g.latitude == null || g.longitude == null) return false;
        const R = 6371;
        const dLat = ((g.latitude - userLat) * Math.PI) / 180;
        const dLon = ((g.longitude - userLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((userLat * Math.PI) / 180) *
            Math.cos((g.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radius;
      });
    }

    res.json({ gyms, count: gyms.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

gymRouter.get("/mine", requireAuth, requireGymOwner, async (req, res) => {
  try {
    const userId = (req as any).user.id as string;
    const gyms = await findGymsForOwner(userId);
    res.json({ gym: gyms[0] ?? null, gyms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

gymRouter.get("/:id", async (req, res) => {
  try {
    const gym = await getGymById(req.params.id);
    if (!gym) { res.status(404).json({ error: "Gym not found" }); return; }
    res.json({ gym });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

gymRouter.post("/", requireAuth, requireNotGuest, requireGymOwner, async (req, res) => {
  const body = req.body as any;
  const ownerUserId = (req as any).user.id as string;

  try {
    const orderId = body.payment_order_id ?? body.paymentOrderId;
    if (!orderId) {
      res.status(402).json({ error: "Payment required: a one-time ₹1000 registration fee must be paid first." });
      return;
    }

    const paymentRows = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.providerOrderId, orderId),
          eq(payments.type, "gym_registration"),
          eq(payments.status, "paid")
        )
      )
      .limit(1);
    const payment = paymentRows[0];
    if (!payment) {
      res.status(402).json({ error: "Registration payment not found or not completed." });
      return;
    }
    if (payment.userId !== ownerUserId) {
      res.status(403).json({ error: "This payment belongs to another account." });
      return;
    }

    const monthlyFeeInr = body.monthlyFeeInr ?? body.monthly_fee_inr ?? null;

    const gym = (
      await db
        .insert(gymProfiles)
        .values({
          ownerUserId,
          name: body.name,
          ownerName: body.ownerName ?? body.owner_name ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null,
          address: body.address ?? "",
          city: body.city ?? "",
          state: body.state ?? "",
          pincode: body.pincode ?? null,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          timings: body.timings ?? null,
          description: body.description ?? null,
          monthlyFeePaise: monthlyFeeInr != null ? Number(monthlyFeeInr) * 100 : null,
          hasTrialClass: Boolean(body.hasTrialClass ?? body.has_trial_class),
          photoUrls: body.photoUrls ?? body.photo_urls ?? [],
          status: "listed",
          listedAt: new Date().toISOString(),
          verificationStatus: "pending",
          listingFeePaymentId: payment.id,
        })
        .returning()
    )[0]!;

    const disciplines: string[] = body.disciplines ?? [];
    if (Array.isArray(disciplines) && disciplines.length) {
      await db
        .insert(gymDisciplines)
        .values(disciplines.map((d) => ({ gymId: gym.id, discipline: String(d) })))
        .onConflictDoNothing();
    }

    await db
      .insert(gymOwners)
      .values({ userId: ownerUserId, businessName: body.ownerName ?? null, businessPhone: body.phone ?? null, businessEmail: body.email ?? null })
      .onConflictDoNothing();

    await db
      .update(payments)
      .set({ gymId: gym.id, updatedAt: new Date().toISOString() })
      .where(eq(payments.id, payment.id));

    const created = await getGymById(gym.id);
    res.status(201).json({ gym: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

gymRouter.patch("/:id", requireAuth, requireNotGuest, requireGymOwner, async (req, res) => {
  const body = req.body as Record<string, any>;
  const ownerUserId = (req as any).user.id as string;

  try {
    const existing = await getGymRowById(String(req.params.id));
    if (!existing) { res.status(404).json({ error: "Gym not found" }); return; }
    if (existing.ownerUserId !== ownerUserId) {
      res.status(403).json({ error: "You do not have access to this gym." });
      return;
    }

    const update: Record<string, any> = {};
    const direct: Record<string, string> = {
      name: "name",
      owner_name: "ownerName",
      ownerName: "ownerName",
      phone: "phone",
      email: "email",
      address: "address",
      city: "city",
      state: "state",
      pincode: "pincode",
      latitude: "latitude",
      longitude: "longitude",
      timings: "timings",
      description: "description",
      photo_urls: "photoUrls",
      photoUrls: "photoUrls",
    };
    for (const [key, column] of Object.entries(direct)) {
      if (key in body) update[column] = body[key];
    }
    if ("monthly_fee_inr" in body || "monthlyFeeInr" in body) {
      const fee = body.monthly_fee_inr ?? body.monthlyFeeInr;
      update.monthlyFeePaise = fee == null ? null : Number(fee) * 100;
    }
    if ("has_trial_class" in body || "hasTrialClass" in body) {
      update.hasTrialClass = Boolean(body.has_trial_class ?? body.hasTrialClass);
    }

    if (Object.keys(update).length) {
      update.updatedAt = new Date().toISOString();
      await db.update(gymProfiles).set(update).where(eq(gymProfiles.id, existing.id));
    }

    if (Array.isArray(body.disciplines)) {
      await db.delete(gymDisciplines).where(eq(gymDisciplines.gymId, existing.id));
      if (body.disciplines.length) {
        await db
          .insert(gymDisciplines)
          .values(body.disciplines.map((d: string) => ({ gymId: existing.id, discipline: String(d) })))
          .onConflictDoNothing();
      }
    }

    const gym = await getGymById(existing.id);
    res.json({ gym });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
