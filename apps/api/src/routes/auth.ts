import { Router } from "express";
import { sendSmsOtp, verifySmsOtp } from "../services/otp";
import { supabase } from "../config/supabase";

export const authRouter = Router();

// Send OTP via SMS
authRouter.post("/otp/send", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    res.status(400).json({ error: "Phone number is required" });
    return;
  }

  const result = await sendSmsOtp(phone);

  if (!result.success) {
    res.status(500).json({ error: result.error ?? "Failed to send OTP" });
    return;
  }

  res.json({ success: true, message: `OTP sent to ${phone}` });
});

// Verify OTP via SMS
authRouter.post("/otp/verify", async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    res.status(400).json({ error: "Phone and OTP are required" });
    return;
  }

  const result = await verifySmsOtp(phone, otp);

  if (!result.success) {
    res.status(400).json({ error: result.error ?? "Invalid OTP" });
    return;
  }

  res.json({ success: true, message: "OTP verified" });
});

// Send OTP via Email using Supabase Auth
authRouter.post("/otp/send-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true, message: `OTP sent to ${email}` });
});

// Verify OTP via Email using Supabase Auth
authRouter.post("/otp/verify-email", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ success: true, message: "Email OTP verified" });
});
