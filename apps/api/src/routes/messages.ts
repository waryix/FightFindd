import { Router, type IRouter } from "express";
import { supabase } from "../config/supabase";
import { sendPushNotification } from "../services/notifications";

export const messageRouter: IRouter = Router();

messageRouter.get("/:matchId", async (req, res) => {
  const { matchId } = req.params;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const senderIds = [...new Set((data ?? []).map(m => m.sender_id))];
  const { data: fighters } = await supabase
    .from("fighters")
    .select("id, name, avatar_url")
    .in("id", senderIds);

  const fighterMap = Object.fromEntries((fighters ?? []).map(f => [f.id, f]));
  const enriched = (data ?? []).map(m => ({ ...m, sender: fighterMap[m.sender_id] ?? null }));

  res.json({ messages: enriched });
});

messageRouter.post("/:matchId", async (req, res) => {
  const { matchId } = req.params;
  const { sender_id, content } = req.body;

  if (!content?.trim()) { res.status(400).json({ error: "Message cannot be empty" }); return; }

  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender_id, content: content.trim() })
    .select()
    .single();

  if (error) { res.status(400).json({ error: error.message }); return; }

  // Notify the other fighter
  try {
    const { data: match } = await supabase
      .from("sparring_requests")
      .select("sender_id, receiver_id")
      .eq("id", matchId)
      .single();

    if (match) {
      const otherId = match.sender_id === sender_id ? match.receiver_id : match.sender_id;
      const { data: other } = await supabase
        .from("fighters")
        .select("push_token, name")
        .eq("id", otherId)
        .single();
      const { data: sender } = await supabase
        .from("fighters")
        .select("name")
        .eq("id", sender_id)
        .single();

      if (other?.push_token && sender?.name) {
        await sendPushNotification(
          other.push_token,
          `${sender.name}`,
          content.trim(),
          { type: "message", matchId }
        );
      }
    }
  } catch (err: any) { console.error("Notification error:", err.message); }

  res.status(201).json({ message: data });
});
