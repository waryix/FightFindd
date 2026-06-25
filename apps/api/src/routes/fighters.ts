import { Router, type IRouter } from "express";
import type { Fighter } from "@repo/types/fighter";
import { supabase } from "../config/supabase";

export const fighterRouter: IRouter = Router();

fighterRouter.get("/", async (req, res) => {
  const {
    city, skill_level, weight_class, discipline, exclude_id,
    lat, lng, radius_km, min_experience, max_experience,
    min_weight, max_weight, min_height, max_height, min_fights, max_fights,
  } = req.query;

  let query = supabase.from("fighters").select("*");

  if (city) query = query.ilike("city", `%${city}%`);
  if (skill_level) query = query.eq("skill_level", skill_level);
  if (weight_class) query = query.eq("weight_class", weight_class);
  if (discipline) query = query.contains("discipline", [discipline]);
  if (exclude_id) query = query.neq("id", exclude_id);
  if (min_experience) query = query.gte("years_experience", Number(min_experience));
  if (max_experience) query = query.lte("years_experience", Number(max_experience));
  if (min_weight) query = query.gte("weight_kg", Number(min_weight));
  if (max_weight) query = query.lte("weight_kg", Number(max_weight));
  if (min_height) query = query.gte("height_cm", Number(min_height));
  if (max_height) query = query.lte("height_cm", Number(max_height));
  if (min_fights) {
    const min = Number(min_fights);
    query = query.or(`total_amateur_fights.gte.${min},total_pro_fights.gte.${min}`);
  }
  if (max_fights) {
    const max = Number(max_fights);
    query = query.or(`total_amateur_fights.lte.${max},total_pro_fights.lte.${max}`);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  let fighters = data ?? [];

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

fighterRouter.get("/phone/:phone", async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { data, error } = await supabase.from("fighters").select("*").eq("phone", phone).single();
  if (error || !data) { res.status(404).json({ fighter: null }); return; }
  res.json({ fighter: data });
});

fighterRouter.get("/email/:email", async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { data, error } = await supabase.from("fighters").select("*").eq("email", email).single();
  if (error || !data) { res.status(404).json({ fighter: null }); return; }
  res.json({ fighter: data });
});

fighterRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabase.from("fighters").select("*").eq("id", req.params.id).single();
  if (error) { res.status(404).json({ error: "Fighter not found" }); return; }
  res.json({ fighter: data });
});

fighterRouter.post("/", async (req, res) => {
  const body = req.body as any;
  const { data, error } = await supabase.from("fighters").insert({
    name: body.name, phone: body.phone, email: body.email ?? null,
    city: body.city, state: body.state,
    latitude: body.latitude ?? 12.9716, longitude: body.longitude ?? 77.5946,
    discipline: body.discipline, skill_level: body.skillLevel,
    weight_class: body.weightClass, age_years: body.ageYears,
    years_experience: body.yearsExperience, height_cm: body.heightCm ?? null,
    weight_kg: body.weightKg ?? null, total_amateur_fights: body.totalAmateurFights ?? 0,
    total_pro_fights: body.totalProFights ?? 0, bio: body.bio ?? null, avatar_url: body.avatarUrl ?? null,
  }).select().single();
  if (error) { res.status(400).json({ error: error.message }); return; }
  res.status(201).json({ fighter: data });
});

fighterRouter.patch("/:id", async (req, res) => {
  const { data, error } = await supabase.from("fighters").update(req.body).eq("id", req.params.id).select().single();
  if (error) { res.status(400).json({ error: error.message }); return; }
  res.json({ fighter: data });
});
