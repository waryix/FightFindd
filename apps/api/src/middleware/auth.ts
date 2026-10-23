import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { sessions, users } from "../db/schema";
import { sha256Hex } from "../lib/hash";

export async function requireNotGuest(req: Request, res: Response, next: NextFunction) {
  try {
    const id = (req as any).user?.id;
    if (!id) {
      res.status(401).json({ error: "Missing account." });
      return;
    }
    const rows = await db
      .select({ isGuest: users.isGuest })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!rows[0] || rows[0].isGuest) {
      res.status(403).json({ error: "Guest accounts can only browse FightFind. Create an account to continue." });
      return;
    }
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Authorization failed" });
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token || token === "undefined" || token === "null") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const rows = await db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.refreshTokenHash, sha256Hex(token)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    if (row.session.revokedAt) {
      res.status(401).json({ error: "Session revoked" });
      return;
    }

    if (row.session.expiresAt && new Date(row.session.expiresAt) < new Date()) {
      res.status(401).json({ error: "Session expired" });
      return;
    }

    await db
      .update(sessions)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(sessions.id, row.session.id));

    (req as any).user = {
      token,
      email: row.user.email,
      id: row.user.id,
    };
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Authentication failed" });
  }
}
