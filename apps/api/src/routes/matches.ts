import { Router } from "express";
import { supabase } from "../config/supabase";

export const matchRouter = Router();

matchRouter.get("/", async (req, res) => {
  const { fighter_id } = req.query;

  let query = supabase.from("sparring_requests").select("*");

  if (fighter_id) {
    query = query.or(`sender_id.eq.${fighter_id},receiver_id.eq.${fighter_id}`);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ matches: data, count: data?.length ?? 0 });
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
