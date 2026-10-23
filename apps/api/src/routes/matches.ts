import { Router, type IRouter } from "express";
import { desc, eq, or } from "drizzle-orm";
import { db } from "../config/db";
import { sparringRequests } from "../db/schema";
import { getFightersByUserIds } from "../db/loaders";
import { mapSparring } from "../db/mappers";
import { sendPushNotification } from "../services/notifications";
import { requireNotGuest } from "../middleware/auth";

export const matchRouter: IRouter = Router();

matchRouter.get("/", async (req, res) => {
  const { fighter_id } = req.query;

  try {
    const rows = fighter_id
      ? await db
          .select()
          .from(sparringRequests)
          .where(
            or(
              eq(sparringRequests.senderId, String(fighter_id)),
              eq(sparringRequests.receiverId, String(fighter_id))
            )
          )
          .orderBy(desc(sparringRequests.createdAt))
      : await db.select().from(sparringRequests).orderBy(desc(sparringRequests.createdAt));

    if (rows.length === 0) { res.json({ matches: [], count: 0 }); return; }

    const ids = [...new Set(rows.flatMap((m) => [m.senderId, m.receiverId]))];
    const fighters = await getFightersByUserIds(ids);
    const fighterMap: Record<string, any> = Object.fromEntries(fighters.map((f) => [f.id, f]));

    const enriched = rows.map((m) => ({
      ...mapSparring(m),
      sender: fighterMap[m.senderId] ?? null,
      receiver: fighterMap[m.receiverId] ?? null,
    }));

    res.json({ matches: enriched, count: enriched.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

matchRouter.post("/", requireNotGuest, async (req, res) => {
  const body = req.body as any;

  try {
    const match = (
      await db
        .insert(sparringRequests)
        .values({
          senderId: body.sender_id ?? body.senderId,
          receiverId: body.receiver_id ?? body.receiverId,
          discipline: body.discipline ?? "mixed",
          proposedDate: body.proposed_date ?? body.proposedDate ?? new Date().toISOString(),
          proposedLocation: body.proposed_location ?? body.proposedLocation ?? "",
          message: body.message ?? null,
          status: body.status ?? "pending",
        })
        .returning()
    )[0]!;

    try {
      const fighters = await getFightersByUserIds([match.senderId, match.receiverId]);
      const receiverFighter = fighters.find((f) => f.id === match.receiverId);
      const senderFighter = fighters.find((f) => f.id === match.senderId);
      if (receiverFighter?.push_token && senderFighter?.name) {
        await sendPushNotification(
          receiverFighter.push_token,
          "New Sparring Request",
          `${senderFighter.name} wants to spar with you!`,
          { type: "sparring_request", matchId: match.id, senderId: match.senderId }
        );
      }
    } catch (err: any) {
      console.error("Notification error:", err.message);
    }

    res.status(201).json({ match: mapSparring(match) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

matchRouter.patch("/:id/status", requireNotGuest, async (req, res) => {
  const { status } = req.body;
  const matchId = String(req.params.id);

  try {
    const updated = await db
      .update(sparringRequests)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(sparringRequests.id, matchId))
      .returning();
    const match = updated[0];
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }

    try {
      if (status === "accepted" || status === "declined") {
        const fighters = await getFightersByUserIds([match.senderId, match.receiverId]);
        const senderFighter = fighters.find((f) => f.id === match.senderId);
        const receiverFighter = fighters.find((f) => f.id === match.receiverId);
        if (senderFighter?.push_token && receiverFighter?.name) {
          await sendPushNotification(
            senderFighter.push_token,
            status === "accepted" ? "Request Accepted!" : "Request Declined",
            status === "accepted"
              ? `${receiverFighter.name} accepted your sparring request!`
              : `${receiverFighter.name} declined your sparring request.`,
            { type: "request_status", matchId, status }
          );
        }
      }
    } catch (err: any) {
      console.error("Notification error:", err.message);
    }

    res.json({ match: mapSparring(match) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
