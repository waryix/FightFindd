import { Router } from "express";
import { supabase } from "../config/supabase";

export const gymRouter = Router();

gymRouter.get("/", async (req, res) => {
  const { city, discipline } = req.query;

  let query = supabase.from("gyms").select("*");

  if (city) query = query.ilike("city", `%${city}%`);
  if (discipline) query = query.contains("disciplines", [discipline]);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ gyms: data, count: data?.length ?? 0 });
});

gymRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("gyms")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) {
    res.status(404).json({ error: "Gym not found" });
    return;
  }

  res.json({ gym: data });
});

gymRouter.post("/", async (req, res) => {
  const { data, error } = await supabase
    .from("gyms")
    .insert(req.body)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ gym: data });
});
