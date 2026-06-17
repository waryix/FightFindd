import { Router } from "express";
import type { Fighter } from "@repo/types/fighter";

export const fighterRouter = Router();

fighterRouter.get("/", async (_req, res) => {
  res.json({ message: "List all fighters — coming soon" });
});

fighterRouter.get("/:id", async (req, res) => {
  res.json({ message: `Get fighter ${req.params.id} — coming soon` });
});

fighterRouter.post("/", async (req, res) => {
  const body = req.body as Partial<Fighter>;
  res.json({ message: "Create fighter — coming soon", received: body });
});
