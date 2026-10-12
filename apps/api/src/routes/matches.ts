import { Router, type IRouter } from "express";
import { db, parseFighter } from "../config/db";
import { sendPushNotification } from "../services/notifications";

export const matchRouter: IRouter = Router();

matchRouter.get("/", (req, res) => {
  const { fighter_id } = req.query;

  let rows: any[];
  if (fighter_id) {
    rows = db.prepare(
      "SELECT * FROM sparring_requests WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at DESC"
    ).all(fighter_id, fighter_id) as any[];
  } else {
    rows = db.prepare("SELECT * FROM sparring_requests ORDER BY created_at DESC").all() as any[];
  }

  if (rows.length === 0) { res.json({ matches: [], count: 0 }); return; }

  const fighterIds = [...new Set(rows.flatMap(m => [m.sender_id, m.receiver_id]))];
  const placeholders = fighterIds.map(() => "?").join(",");
  const fighters = (db.prepare(
    `SELECT id, name, city, skill_level, weight_class, discipline FROM fighters WHERE id IN (${placeholders})`
  ).all(...fighterIds) as any[]).map(parseFighter);
  const fighterMap: Record<string, any> = Object.fromEntries(fighters.map(f => [f.id, f]));

  const enriched = rows.map(m => ({
    ...m,
    sender: fighterMap[m.sender_id] ?? null,
    receiver: fighterMap[m.receiver_id] ?? null,
  }));

  res.json({ matches: enriched, count: enriched.length });
});

matchRouter.post("/", async (req, res) => {
  const body = req.body as any;
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO sparring_requests (id, sender_id, receiver_id, discipline, proposed_date,
      proposed_location, message, status)
    VALUES (@id, @sender_id, @receiver_id, @discipline, @proposed_date,
      @proposed_location, @message, @status)
  `).run({
    id,
    sender_id: body.sender_id,
    receiver_id: body.receiver_id,
    discipline: body.discipline ?? null,
    proposed_date: body.proposed_date ?? null,
    proposed_location: body.proposed_location ?? null,
    message: body.message ?? null,
    status: body.status ?? "pending",
  });

  const match = db.prepare("SELECT * FROM sparring_requests WHERE id = ?").get(id);

  try {
    const receiver = db.prepare("SELECT name, push_token FROM fighters WHERE id = ?").get(body.receiver_id) as any;
    const sender = db.prepare("SELECT name FROM fighters WHERE id = ?").get(body.sender_id) as any;
    if (receiver?.push_token && sender?.name) {
      await sendPushNotification(receiver.push_token, "New Sparring Request", `${sender.name} wants to spar with you!`, { type: "sparring_request", matchId: id, senderId: body.sender_id });
    }
  } catch (err: any) { console.error("Notification error:", err.message); }

  res.status(201).json({ match });
});

matchRouter.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE sparring_requests SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);

  const match = db.prepare("SELECT * FROM sparring_requests WHERE id = ?").get(req.params.id);
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  try {
    if (status === "accepted" || status === "declined") {
      const m = match as any;
      const sender = db.prepare("SELECT push_token FROM fighters WHERE id = ?").get(m.sender_id) as any;
      const receiver = db.prepare("SELECT name FROM fighters WHERE id = ?").get(m.receiver_id) as any;
      if (sender?.push_token && receiver?.name) {
        await sendPushNotification(sender.push_token, status === "accepted" ? "Request Accepted!" : "Request Declined", status === "accepted" ? `${receiver.name} accepted your sparring request!` : `${receiver.name} declined your sparring request.`, { type: "request_status", matchId: req.params.id, status });
      }
    }
  } catch (err: any) { console.error("Notification error:", err.message); }

  res.json({ match });
});
