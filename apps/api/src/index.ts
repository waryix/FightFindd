import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { fighterRouter } from "./routes/fighters";
import { gymRouter } from "./routes/gyms";
import { matchRouter } from "./routes/matches";
import { authRouter } from "./routes/auth";
import { requireAuth } from "./middleware/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

// Public routes
app.get("/", (_req, res) => {
  res.json({
    name: "FightFind API",
    version: "1.0.0",
    status: "running",
    message: "Welcome to FightFind API. Use the mobile app to access features.",
    docs: "https://github.com/waryix/FightFind"
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fightfind-api" });
});

// Auth routes — public (no auth required)
app.use("/api/auth", authRouter);

// Public read routes — no auth required for discovery
app.use("/api/fighters", fighterRouter);
app.use("/api/gyms", gymRouter);

// Protected routes — auth required
app.use("/api/matches", requireAuth, matchRouter);

app.listen(PORT, () => {
  console.log(`FightFind API running on port ${PORT}`);
});
