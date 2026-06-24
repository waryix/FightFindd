import { Router } from "express";
import { supabase } from "../config/supabase";

export const matchRouter = Router();

matchRouter.get("/", async (req, res) => {
  const { fighter_id } = req.query;

  let query = supabase
    .from("sparring_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (fighter_id) {
    query = query.or(`sender_id.eq.${fighter_id},receiver_id.eq.${fighter_id}`);
  }

  const { data: matches, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!matches || matches.length === 0) {
    res.json({ matches: [], count: 0 });
    return;
  }

  // Get unique fighter IDs
  const fighterIds = [...new Set([
    ...matches.map(m => m.sender_id),
    ...matches.map(m => m.receiver_id),
  ])];

  // Fetch fighter names
  const { data: fighters } = await supabase
    .from("fighters")
    .select("id, name, city, skill_level, weight_class, discipline")
    .in("id", fighterIds);

  const fighterMap = Object.fromEntries(
    (fighters ?? []).map(f => [f.id, f])
  );

  // Attach fighter details to matches
  const enrichedMatches = matches.map(m => ({
    ...m,
    sender: fighterMap[m.sender_id] ?? null,
    receiver: fighterMap[m.receiver_id] ?? null,
  }));

  res.json({ matches: enrichedMatches, count: enrichedMatches.length });
});

matchRouter.post("/", async (req, res) => {
  const { data, error } = await supabase
    .from("sparring_requests")
    .insert(req.body)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ match: data });
});

matchRouter.patch("/:id/status", async (req, res) => {
  const { status } = req.body;

  const { data, error } = await supabase
    .from("sparring_requests")
    .update({ status })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ match: data });
});
