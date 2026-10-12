import { Router, type IRouter } from "express";
import { db, parseGym } from "../config/db";

export const gymRouter: IRouter = Router();

gymRouter.get("/", (req, res) => {
  const { city, discipline, lat, lng, radius_km, search, has_trial } = req.query;

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    where.push("(name LIKE ? OR city LIKE ? OR address LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (city) { where.push("city LIKE ?"); params.push(`%${city}%`); }
  if (discipline) { where.push("disciplines LIKE ?"); params.push(`%"${discipline}"%`); }
  if (has_trial === "true") { where.push("has_trial_class = 1"); }

  const sql = `SELECT * FROM gyms${where.length ? " WHERE " + where.join(" AND ") : ""}`;
  let gyms = (db.prepare(sql).all(...params) as any[]).map(parseGym);

  if (lat && lng && radius_km) {
    const userLat = parseFloat(lat as string);
    const userLng = parseFloat(lng as string);
    const radius = parseFloat(radius_km as string);
    gyms = gyms.filter(g => {
      const R = 6371;
      const dLat = ((g.latitude - userLat) * Math.PI) / 180;
      const dLon = ((g.longitude - userLng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLat * Math.PI) / 180) * Math.cos((g.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radius;
    });
  }

  res.json({ gyms, count: gyms.length });
});

gymRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM gyms WHERE id = ?").get(req.params.id);
  if (!row) { res.status(404).json({ error: "Gym not found" }); return; }
  res.json({ gym: parseGym(row) });
});

gymRouter.post("/", (req, res) => {
  const body = req.body as any;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO gyms (id, name, owner_name, phone, email, address, city, state, pincode,
      latitude, longitude, disciplines, monthly_fee_inr, has_trial_class, timings,
      description, photo_urls, is_verified)
    VALUES (@id, @name, @owner_name, @phone, @email, @address, @city, @state, @pincode,
      @latitude, @longitude, @disciplines, @monthly_fee_inr, @has_trial_class, @timings,
      @description, @photo_urls, @is_verified)
  `).run({
    id,
    name: body.name,
    owner_name: body.ownerName ?? body.owner_name ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    address: body.address ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    pincode: body.pincode ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    disciplines: JSON.stringify(body.disciplines ?? []),
    monthly_fee_inr: body.monthlyFeeInr ?? body.monthly_fee_inr ?? null,
    has_trial_class: body.hasTrialClass || body.has_trial_class ? 1 : 0,
    timings: body.timings ?? null,
    description: body.description ?? null,
    photo_urls: JSON.stringify(body.photoUrls ?? body.photo_urls ?? []),
    is_verified: body.isVerified || body.is_verified ? 1 : 0,
  });
  const row = db.prepare("SELECT * FROM gyms WHERE id = ?").get(id);
  res.status(201).json({ gym: parseGym(row) });
});
