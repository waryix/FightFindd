import { Router, type IRouter } from "express";
import { sendPushNotification } from "../services/notifications";
import { supabase } from "../config/supabase";

export const authRouter: IRouter = Router();

authRouter.post("/otp/send", async (req, res) => {
  const { phone } = req.body;
  if (!phone) { res.status(400).json({ error: "Phone number is required" }); return; }
  res.json({ success: true, message: `OTP sent to ${phone}` });
});

authRouter.post("/otp/verify", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) { res.status(400).json({ error: "Phone and OTP are required" }); return; }
  res.json({ success: true, message: "OTP verified" });
});

authRouter.post("/otp/send-email", async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true, message: `OTP sent to ${email}` });
});

authRouter.post("/otp/verify-email", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) { res.status(400).json({ error: "Email and OTP are required" }); return; }
  const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
  if (error) { res.status(400).json({ error: error.message }); return; }
  res.json({ success: true, message: "Email OTP verified" });
});
