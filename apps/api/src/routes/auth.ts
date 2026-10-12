import { Router, type IRouter, type Response } from "express";
import { randomInt, randomUUID } from "node:crypto";
import { db, parseFighter } from "../config/db";
import { sendOtpEmail, isEmailConfigured } from "../services/email";

export const authRouter: IRouter = Router();

const DEV_OTP = process.env.DEV_OTP ?? "123456";
const OTP_TTL_MS = Number(process.env.OTP_TTL_MINUTES ?? 10) * 60_000;
const OTP_RESEND_MS = Number(process.env.OTP_RESEND_SECONDS ?? 60) * 1000;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

function isValidOtp(otp: string): boolean {
  return otp === DEV_OTP || /^\d{6}$/.test(otp);
}

function isDevBypassEnabled(): boolean {
  return process.env.OTP_DEV_BYPASS === "true" || !isEmailConfigured();
}

function issueSession(res: Response, email: string) {
  const token = `local_${randomUUID()}`;
  const fighter = db.prepare("SELECT * FROM fighters WHERE email = ?").get(email) as any;

  db.prepare(
    "INSERT INTO sessions (token, email, fighter_id) VALUES (?, ?, ?)"
  ).run(token, email, fighter?.id ?? null);

  res.json({
    success: true,
    message: "Email OTP verified",
    access_token: token,
    session: { access_token: token },
    user: { id: fighter?.id ?? null, email },
  });
}

authRouter.post("/otp/send", (req, res) => {
  const { phone } = req.body;
  if (!phone) { res.status(400).json({ error: "Phone number is required" }); return; }
  console.log(`[dev otp] phone ${phone} -> ${DEV_OTP}`);
  res.json({ success: true, message: `OTP sent to ${phone}` });
});

authRouter.post("/otp/verify", (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) { res.status(400).json({ error: "Phone and OTP are required" }); return; }
  if (!isValidOtp(otp)) { res.status(400).json({ error: "Invalid OTP" }); return; }
  res.json({ success: true, message: "OTP verified" });
});

authRouter.post("/otp/send-email", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") { res.status(400).json({ error: "Email is required" }); return; }

  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }

  const now = Date.now();
  const existing = db.prepare("SELECT * FROM email_otps WHERE email = ?").get(normalized) as any;
  if (existing && now - existing.last_sent_at < OTP_RESEND_MS) {
    const retry = Math.ceil((OTP_RESEND_MS - (now - existing.last_sent_at)) / 1000);
    res.status(429).json({ error: `Please wait ${retry}s before requesting another code` });
    return;
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = now + OTP_TTL_MS;

  db.prepare(`
    INSERT INTO email_otps (email, code, expires_at, attempts, last_sent_at)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(email) DO UPDATE SET
      code = excluded.code,
      expires_at = excluded.expires_at,
      attempts = 0,
      last_sent_at = excluded.last_sent_at
  `).run(normalized, code, expiresAt, now);

  const result = await sendOtpEmail(normalized, code);

  if (!result.sent && !result.dev) {
    db.prepare("DELETE FROM email_otps WHERE email = ?").run(normalized);
    res.status(502).json({ error: "Could not send the verification email. Please try again." });
    return;
  }

  res.json({
    success: true,
    message: `OTP sent to ${normalized}`,
    ...(result.dev ? { devOtp: code } : {}),
  });
});

authRouter.post("/otp/verify-email", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) { res.status(400).json({ error: "Email and OTP are required" }); return; }

  const normalized = email.trim().toLowerCase();

  if (isDevBypassEnabled() && String(otp).trim() === DEV_OTP) {
    db.prepare("DELETE FROM email_otps WHERE email = ?").run(normalized);
    issueSession(res, normalized);
    return;
  }

  const row = db.prepare("SELECT * FROM email_otps WHERE email = ?").get(normalized) as any;
  if (!row) {
    res.status(400).json({ error: "No verification code found. Please request a new one." });
    return;
  }

  if (Date.now() > row.expires_at) {
    db.prepare("DELETE FROM email_otps WHERE email = ?").run(normalized);
    res.status(400).json({ error: "This code has expired. Please request a new one." });
    return;
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });
    return;
  }

  if (row.code !== String(otp).trim()) {
    db.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE email = ?").run(normalized);
    res.status(400).json({ error: "Invalid code. Please check and try again." });
    return;
  }

  db.prepare("DELETE FROM email_otps WHERE email = ?").run(normalized);
  issueSession(res, normalized);
});

authRouter.post("/guest", (_req, res) => {
  const GUEST_EMAIL = "guest@fightfind.dev";
  let fighter = db.prepare("SELECT * FROM fighters WHERE email = ?").get(GUEST_EMAIL) as any;

  if (!fighter) {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO fighters (id, name, phone, email, city, state, discipline, skill_level,
        weight_class, age_years, years_experience, total_amateur_fights, total_pro_fights, bio)
      VALUES (@id, @name, @phone, @email, @city, @state, @discipline, @skill_level,
        @weight_class, @age_years, @years_experience, @total_amateur_fights, @total_pro_fights, @bio)
    `).run({
      id,
      name: "Guest Fighter",
      phone: "+910000000000",
      email: GUEST_EMAIL,
      city: "Bengaluru",
      state: "Karnataka",
      discipline: JSON.stringify(["boxing", "mma"]),
      skill_level: "intermediate",
      weight_class: "lightweight",
      age_years: 25,
      years_experience: 3,
      total_amateur_fights: 5,
      total_pro_fights: 0,
      bio: "Just browsing FightFind as a guest.",
    });
    fighter = db.prepare("SELECT * FROM fighters WHERE id = ?").get(id);
  }

  const token = `local_guest_${randomUUID()}`;
  db.prepare("INSERT INTO sessions (token, email, fighter_id) VALUES (?, ?, ?)").run(token, GUEST_EMAIL, fighter.id);

  res.json({ access_token: token, fighter: parseFighter(fighter) });
});
