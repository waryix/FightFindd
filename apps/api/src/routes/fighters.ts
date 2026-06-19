import { Router } from "express";
import type { Fighter } from "@repo/types/fighter";
import { supabase } from "../config/supabase";

export const fighterRouter = Router();

fighterRouter.get("/", async (req, res) => {
  const { city, skill_level, weight_class, discipline } = req.query;

  let query = supabase.from("fighters").select("*");

  if (city) query = query.ilike("city", `%${city}%`);
  if (skill_level) query = query.eq("skill_level", skill_level);
  if (weight_class) query = query.eq("weight_class", weight_class);
  if (discipline) query = query.contains("discipline", [discipline]);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ fighters: data, count: data?.length ?? 0 });
});

fighterRouter.get("/phone/:phone", async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { data, error } = await supabase
    .from("fighters")
    .select("*")
    .eq("phone", phone)
    .single();

  if (error || !data) {
    res.status(404).json({ fighter: null });
    return;
  }

  res.json({ fighter: data });
});

fighterRouter.get("/email/:email", async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { data, error } = await supabase
    .from("fighters")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) {
    res.status(404).json({ fighter: null });
    return;
  }

  res.json({ fighter: data });
});

fighterRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("fighters")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) {
    res.status(404).json({ error: "Fighter not found" });
    return;
  }

  res.json({ fighter: data });
});

fighterRouter.post("/", async (req, res) => {
  const body = req.body as Partial<Fighter>;

  const { data, error } = await supabase
    .from("fighters")
    .insert({
      name: body.name,
      phone: body.phone,
      email: (body as any).email ?? null,
      city: body.city,
      state: body.state,
      latitude: body.latitude,
      longitude: body.longitude,
      discipline: body.discipline,
      skill_level: body.skillLevel,
      weight_class: body.weightClass,
      age_years: body.ageYears,
      years_experience: body.yearsExperience,
      bio: body.bio,
      avatar_url: body.avatarUrl,
    })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ fighter: data });
});

fighterRouter.patch("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("fighters")
    .update(req.body)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ fighter: data });
});
