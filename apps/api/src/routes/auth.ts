import { Router } from "express";
import type { OtpRequest, OtpVerify } from "@repo/types/auth";

export const authRouter = Router();

authRouter.post("/otp/send", async (req, res) => {
  const body = req.body as OtpRequest;
  res.json({ message: "Send OTP — coming soon", phone: body.phone });
});

authRouter.post("/otp/verify", async (req, res) => {
  const body = req.body as OtpVerify;
  res.json({ message: "Verify OTP — coming soon", phone: body.phone });
});
