import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../config/db";
import { messages, sparringRequests } from "../db/schema";
import { getFightersByUserIds } from "../db/loaders";
import { mapMessage } from "../db/mappers";
import { sendPushNotification } from "../services/notifications";
import { requireNotGuest } from "../middleware/auth";

export const messageRouter: IRouter = Router();

messageRouter.get("/:matchId", async (req, res) => {
  const { matchId } = req.params;

  try {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.matchId, matchId))
      .orderBy(asc(messages.createdAt));

    const senderIds = [...new Set(rows.map((m) => m.senderId))];
    const fighters = await getFightersByUserIds(senderIds);
    const senderMap: Record<string, any> = {};
    for (const f of fighters) {
      senderMap[f.id] = { id: f.id, name: f.name, avatar_url: f.avatar_url };
    }

    const enriched = rows.map((m) => ({
      ...mapMessage(m),
      sender: senderMap[m.senderId] ?? null,
    }));
    res.json({ messages: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

messageRouter.post("/:matchId", requireNotGuest, async (req, res) => {
  const matchId = String(req.params.matchId);
  const { sender_id, content } = req.body;

  if (!content?.trim()) { res.status(400).json({ error: "Message cannot be empty" }); return; }

  try {
    const message = (
      await db
        .insert(messages)
        .values({ matchId, senderId: sender_id, content: content.trim() })
        .returning()
    )[0];

    try {
      const match = (
        await db
          .select()
          .from(sparringRequests)
          .where(eq(sparringRequests.id, matchId))
          .limit(1)
      )[0];

      if (match) {
        const otherId = match.senderId === sender_id ? match.receiverId : match.senderId;
        const fighters = await getFightersByUserIds([otherId, sender_id]);
        const other = fighters.find((f) => f.id === otherId);
        const sender = fighters.find((f) => f.id === sender_id);
        if (other?.push_token && sender?.name) {
          await sendPushNotification(other.push_token, `${sender.name}`, content.trim(), {
            type: "message",
            matchId,
          });
        }
      }
    } catch (err: any) {
      console.error("Notification error:", err.message);
    }

    res.status(201).json({ message: mapMessage(message) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
