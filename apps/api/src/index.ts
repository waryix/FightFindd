import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { fighterRouter } from "./routes/fighters";
import { gymRouter } from "./routes/gyms";
import { matchRouter } from "./routes/matches";
import { authRouter } from "./routes/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fightfind-api" });
});

app.use("/api/fighters", fighterRouter);
app.use("/api/gyms", gymRouter);
app.use("/api/matches", matchRouter);
app.use("/api/auth", authRouter);

app.listen(PORT, () => {
  console.log(`FightFind API running on http://localhost:${PORT}`);
});
