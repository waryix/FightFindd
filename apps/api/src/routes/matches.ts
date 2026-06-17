import { Router } from "express";
import type { SparringRequest } from "@repo/types/match";

export const matchRouter = Router();

matchRouter.get("/", async (_req, res) => {
  res.json({ message: "List matches — coming soon" });
});

matchRouter.post("/", async (req, res) => {
  const body = req.body as Partial<SparringRequest>;
  res.json({ message: "Create match request — coming soon", received: body });
});

matchRouter.patch("/:id/status", async (req, res) => {
  res.json({ message: `Update match ${req.params.id} status — coming soon` });
});
