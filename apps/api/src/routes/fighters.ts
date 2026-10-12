import { Router, type IRouter } from "express";
import { db, parseFighter } from "../config/db";

export const fighterRouter: IRouter = Router();

const FIGHTER_COLUMNS = [
  "name", "phone", "email", "city", "state", "latitude", "longitude",
  "discipline", "skill_level", "weight_class", "age_years", "years_experience",
  "height_cm", "weight_kg", "total_amateur_fights", "total_pro_fights",
  "bio", "avatar_url", "push_token", "gym_id",
];

fighterRouter.get("/", (req, res) => {
  const {
    city, skill_level, weight_class, discipline, exclude_id,
    lat, lng, radius_km, min_experience, max_experience,
    min_weight, max_weight, min_height, max_height,
    min_fights, max_fights, search,
  } = req.query;

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    where.push("(name LIKE ? OR city LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (city) { where.push("city LIKE ?"); params.push(`%${city}%`); }
  if (skill_level) { where.push("skill_level = ?"); params.push(skill_level); }
  if (weight_class) { where.push("weight_class = ?"); params.push(weight_class); }
  if (discipline) { where.push("discipline LIKE ?"); params.push(`%"${discipline}"%`); }
  if (exclude_id) { where.push("id != ?"); params.push(exclude_id); }
  if (min_experience) { where.push("years_experience >= ?"); params.push(Number(min_experience)); }
  if (max_experience) { where.push("years_experience <= ?"); params.push(Number(max_experience)); }
  if (min_weight) { where.push("weight_kg >= ?"); params.push(Number(min_weight)); }
  if (max_weight) { where.push("weight_kg <= ?"); params.push(Number(max_weight)); }
  if (min_height) { where.push("height_cm >= ?"); params.push(Number(min_height)); }
  if (max_height) { where.push("height_cm <= ?"); params.push(Number(max_height)); }
  if (min_fights) {
    where.push("(total_amateur_fights >= ? OR total_pro_fights >= ?)");
    params.push(Number(min_fights), Number(min_fights));
  }
  if (max_fights) {
    where.push("(total_amateur_fights <= ? OR total_pro_fights <= ?)");
    params.push(Number(max_fights), Number(max_fights));
  }

  const sql = `SELECT * FROM fighters${where.length ? " WHERE " + where.join(" AND ") : ""}`;
  let fighters = (db.prepare(sql).all(...params) as any[]).map(parseFighter);

  if (lat && lng && radius_km) {
    const userLat = parseFloat(lat as string);
    const userLng = parseFloat(lng as string);
    const radius = parseFloat(radius_km as string);
    fighters = fighters.filter(f => {
      const R = 6371;
      const dLat = ((f.latitude - userLat) * Math.PI) / 180;
      const dLon = ((f.longitude - userLng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLat * Math.PI) / 180) * Math.cos((f.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radius;
    });
  }

  res.json({ fighters, count: fighters.length });
});

fighterRouter.get("/phone/:phone", (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const row = db.prepare("SELECT * FROM fighters WHERE phone = ?").get(phone);
  if (!row) { res.status(404).json({ fighter: null }); return; }
  res.json({ fighter: parseFighter(row) });
});

fighterRouter.get("/email/:email", (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const row = db.prepare("SELECT * FROM fighters WHERE email = ?").get(email);
  if (!row) { res.status(404).json({ fighter: null }); return; }
  res.json({ fighter: parseFighter(row) });
});

fighterRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM fighters WHERE id = ?").get(req.params.id);
  if (!row) { res.status(404).json({ error: "Fighter not found" }); return; }
  res.json({ fighter: parseFighter(row) });
});

fighterRouter.post("/", (req, res) => {
  const body = req.body as any;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO fighters (id, name, phone, email, city, state, latitude, longitude,
      discipline, skill_level, weight_class, age_years, years_experience, height_cm,
      weight_kg, total_amateur_fights, total_pro_fights, bio, avatar_url)
    VALUES (@id, @name, @phone, @email, @city, @state, @latitude, @longitude,
      @discipline, @skill_level, @weight_class, @age_years, @years_experience, @height_cm,
      @weight_kg, @total_amateur_fights, @total_pro_fights, @bio, @avatar_url)
  `).run({
    id,
    name: body.name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    latitude: body.latitude ?? 12.9716,
    longitude: body.longitude ?? 77.5946,
    discipline: JSON.stringify(body.discipline ?? []),
    skill_level: body.skillLevel ?? null,
    weight_class: body.weightClass ?? null,
    age_years: body.ageYears ?? 0,
    years_experience: body.yearsExperience ?? 0,
    height_cm: body.heightCm ?? null,
    weight_kg: body.weightKg ?? null,
    total_amateur_fights: body.totalAmateurFights ?? 0,
    total_pro_fights: body.totalProFights ?? 0,
    bio: body.bio ?? null,
    avatar_url: body.avatarUrl ?? null,
  });
  const row = db.prepare("SELECT * FROM fighters WHERE id = ?").get(id);
  res.status(201).json({ fighter: parseFighter(row) });
});

fighterRouter.patch("/:id", (req, res) => {
  const body = req.body as Record<string, any>;
  const sets: string[] = [];
  const params: any[] = [];

  for (const col of FIGHTER_COLUMNS) {
    if (!(col in body)) continue;
    sets.push(`${col} = ?`);
    params.push(col === "discipline" ? JSON.stringify(body[col] ?? []) : body[col]);
  }

  if (sets.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  params.push(req.params.id);
  db.prepare(`UPDATE fighters SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  const row = db.prepare("SELECT * FROM fighters WHERE id = ?").get(req.params.id);
  if (!row) { res.status(404).json({ error: "Fighter not found" }); return; }
  res.json({ fighter: parseFighter(row) });
});
