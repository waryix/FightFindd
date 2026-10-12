import { Router, type IRouter } from "express";
import { db } from "../config/db";
import { sendPushNotification } from "../services/notifications";

export const messageRouter: IRouter = Router();

messageRouter.get("/:matchId", (req, res) => {
  const { matchId } = req.params;

  const rows = db.prepare(
    "SELECT * FROM messages WHERE match_id = ? ORDER BY created_at ASC"
  ).all(matchId) as any[];

  const senderIds = [...new Set(rows.map(m => m.sender_id))];
  const senderMap: Record<string, any> = {};
  if (senderIds.length) {
    const placeholders = senderIds.map(() => "?").join(",");
    const fighters = db.prepare(
      `SELECT id, name, avatar_url FROM fighters WHERE id IN (${placeholders})`
    ).all(...senderIds) as any[];
    for (const f of fighters) senderMap[f.id] = f;
  }

  const enriched = rows.map(m => ({ ...m, sender: senderMap[m.sender_id] ?? null }));
  res.json({ messages: enriched });
});

messageRouter.post("/:matchId", async (req, res) => {
  const { matchId } = req.params;
  const { sender_id, content } = req.body;

  if (!content?.trim()) { res.status(400).json({ error: "Message cannot be empty" }); return; }

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO messages (id, match_id, sender_id, content) VALUES (?, ?, ?, ?)"
  ).run(id, matchId, sender_id, content.trim());

  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);

  try {
    const match = db.prepare(
      "SELECT sender_id, receiver_id FROM sparring_requests WHERE id = ?"
    ).get(matchId) as any;

    if (match) {
      const otherId = match.sender_id === sender_id ? match.receiver_id : match.sender_id;
      const other = db.prepare("SELECT push_token, name FROM fighters WHERE id = ?").get(otherId) as any;
      const sender = db.prepare("SELECT name FROM fighters WHERE id = ?").get(sender_id) as any;

      if (other?.push_token && sender?.name) {
        await sendPushNotification(other.push_token, `${sender.name}`, content.trim(), { type: "message", matchId });
      }
    }
  } catch (err: any) { console.error("Notification error:", err.message); }

  res.status(201).json({ message });
});
