import { Request, Response, NextFunction } from "express";
import { db } from "../config/db";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as any;

  if (!session) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as any).user = { token, email: session.email, id: session.fighter_id };
  next();
}
