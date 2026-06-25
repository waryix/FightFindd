import { Router, type IRouter } from "express";
import { supabase } from "../config/supabase";

export const gymRouter: IRouter = Router();

gymRouter.get("/", async (req, res) => {
  const { city, discipline, lat, lng, radius_km } = req.query;

  let query = supabase.from("gyms").select("*");
  if (city) query = query.ilike("city", `%${city}%`);
  if (discipline) query = query.contains("disciplines", [discipline]);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  let gyms = data ?? [];

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

gymRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabase.from("gyms").select("*").eq("id", req.params.id).single();
  if (error) { res.status(404).json({ error: "Gym not found" }); return; }
  res.json({ gym: data });
});

gymRouter.post("/", async (req, res) => {
  const { data, error } = await supabase.from("gyms").insert(req.body).select().single();
  if (error) { res.status(400).json({ error: error.message }); return; }
  res.status(201).json({ gym: data });
});
