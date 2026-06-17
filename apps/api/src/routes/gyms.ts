import { Router } from "express";
import type { Gym } from "@repo/types/gym";

export const gymRouter = Router();

gymRouter.get("/", async (_req, res) => {
  res.json({ message: "List all gyms — coming soon" });
});

gymRouter.get("/:id", async (req, res) => {
  res.json({ message: `Get gym ${req.params.id} — coming soon` });
});

gymRouter.post("/", async (req, res) => {
  const body = req.body as Partial<Gym>;
  res.json({ message: "Create gym — coming soon", received: body });
});
