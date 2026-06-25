import { Router, type IRouter } from "express";
import { supabase } from "../config/supabase";
import { sendPushNotification } from "../services/notifications";

export const matchRouter: IRouter = Router();

matchRouter.get("/", async (req, res) => {
  const { fighter_id } = req.query;

  let query = supabase.from("sparring_requests").select("*").order("created_at", { ascending: false });
  if (fighter_id) query = query.or(`sender_id.eq.${fighter_id},receiver_id.eq.${fighter_id}`);

  const { data: matches, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!matches || matches.length === 0) { res.json({ matches: [], count: 0 }); return; }

  const fighterIds = [...new Set([...matches.map(m => m.sender_id), ...matches.map(m => m.receiver_id)])];
  const { data: fighters } = await supabase.from("fighters").select("id, name, city, skill_level, weight_class, discipline").in("id", fighterIds);
  const fighterMap = Object.fromEntries((fighters ?? []).map(f => [f.id, f]));

  const enrichedMatches = matches.map(m => ({ ...m, sender: fighterMap[m.sender_id] ?? null, receiver: fighterMap[m.receiver_id] ?? null }));
  res.json({ matches: enrichedMatches, count: enrichedMatches.length });
});

matchRouter.post("/", async (req, res) => {
  const { data, error } = await supabase.from("sparring_requests").insert(req.body).select().single();
  if (error) { res.status(400).json({ error: error.message }); return; }

  try {
    const { data: receiver } = await supabase.from("fighters").select("name, push_token").eq("id", req.body.receiver_id).single();
    const { data: sender } = await supabase.from("fighters").select("name").eq("id", req.body.sender_id).single();
    if (receiver?.push_token && sender?.name) {
      await sendPushNotification(receiver.push_token, "New Sparring Request", `${sender.name} wants to spar with you!`, { type: "sparring_request", matchId: data.id, senderId: req.body.sender_id });
    }
  } catch (err: any) { console.error("Notification error:", err.message); }

  res.status(201).json({ match: data });
});

matchRouter.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  const { data, error } = await supabase.from("sparring_requests").update({ status }).eq("id", req.params.id).select().single();
  if (error) { res.status(400).json({ error: error.message }); return; }

  try {
    if (status === "accepted" || status === "declined") {
      const { data: match } = await supabase.from("sparring_requests").select("sender_id, receiver_id").eq("id", req.params.id).single();
      if (match) {
        const { data: sender } = await supabase.from("fighters").select("push_token").eq("id", match.sender_id).single();
        const { data: receiver } = await supabase.from("fighters").select("name").eq("id", match.receiver_id).single();
        if (sender?.push_token && receiver?.name) {
          await sendPushNotification(sender.push_token, status === "accepted" ? "Request Accepted!" : "Request Declined", status === "accepted" ? `${receiver.name} accepted your sparring request!` : `${receiver.name} declined your sparring request.`, { type: "request_status", matchId: req.params.id, status });
        }
      }
    }
  } catch (err: any) { console.error("Notification error:", err.message); }

  res.json({ match: data });
});
