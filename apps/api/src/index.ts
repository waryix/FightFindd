import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { fighterRouter } from "./routes/fighters";
import { gymRouter } from "./routes/gyms";
import { matchRouter } from "./routes/matches";
import { authRouter } from "./routes/auth";
import { messageRouter } from "./routes/messages";
import { paymentRouter } from "./routes/payments";
import { requireAuth } from "./middleware/auth";
import { seedIfEmpty } from "./config/db";
import { verifySenderConfiguration } from "./services/email";

dotenv.config();
seedIfEmpty();
verifySenderConfiguration();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "FightFind API",
    version: "1.0.0",
    status: "running",
    message: "Welcome to FightFind API.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fightfind-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/fighters", fighterRouter);
app.use("/api/gyms", gymRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/matches", requireAuth, matchRouter);
app.use("/api/messages", requireAuth, messageRouter);

app.listen(PORT, () => {
  console.log(`FightFind API running on port ${PORT}`);
});
