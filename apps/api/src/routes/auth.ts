import { Router, type IRouter, type Response } from "express";
import { randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../config/db";
import { fighterDisciplines, fighterProfiles, otpChallenges, sessions, users } from "../db/schema";
import { getFighterById } from "../db/loaders";
import { sendOtpEmail, isEmailConfigured } from "../services/email";
import { sha256Hex } from "../lib/hash";

export const authRouter: IRouter = Router();

const DEV_OTP = process.env.DEV_OTP ?? "123456";
const OTP_TTL_MS = Number(process.env.OTP_TTL_MINUTES ?? 10) * 60_000;
const OTP_RESEND_MS = Number(process.env.OTP_RESEND_SECONDS ?? 60) * 1000;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isValidOtp(otp: string): boolean {
  return otp === DEV_OTP || /^\d{6}$/.test(otp);
}

function isDevBypassEnabled(): boolean {
  return process.env.OTP_DEV_BYPASS === "true" || !isEmailConfigured();
}

async function findOrCreateUserByEmail(email: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0];

  const created = await db
    .insert(users)
    .values({ email, name: email.split("@")[0] || "Fighter", isGuest: false })
    .returning();
  return created[0]!;
}

async function issueSession(res: Response, email: string) {
  const user = await findOrCreateUserByEmail(email);
  const token = `local_${randomUUID()}`;

  await db.insert(sessions).values({
    userId: user.id,
    refreshTokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  res.json({
    success: true,
    message: "Email OTP verified",
    access_token: token,
    session: { access_token: token },
    user: { id: user.id, email },
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

  try {
    const now = Date.now();
    const existing = await db
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.identifier, normalized),
          eq(otpChallenges.purpose, "login"),
          isNull(otpChallenges.consumedAt)
        )
      )
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);

    const latest = existing[0];
    if (latest && now - new Date(latest.createdAt).getTime() < OTP_RESEND_MS) {
      const retry = Math.ceil(
        (OTP_RESEND_MS - (now - new Date(latest.createdAt).getTime())) / 1000
      );
      res.status(429).json({ error: `Please wait ${retry}s before requesting another code` });
      return;
    }

    const code = String(randomInt(100000, 1000000));

    await db.insert(otpChallenges).values({
      channel: "email",
      identifier: normalized,
      purpose: "login",
      codeHash: sha256Hex(code),
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    });

    const result = await sendOtpEmail(normalized, code);

    if (!result.sent && !result.dev) {
      await db
        .delete(otpChallenges)
        .where(
          and(eq(otpChallenges.identifier, normalized), eq(otpChallenges.codeHash, sha256Hex(code)))
        );
      res.status(502).json({ error: "Could not send the verification email. Please try again." });
      return;
    }

    res.json({
      success: true,
      message: `OTP sent to ${normalized}`,
      ...(result.dev ? { devOtp: code } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Could not send OTP" });
  }
});

authRouter.post("/otp/verify-email", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) { res.status(400).json({ error: "Email and OTP are required" }); return; }

  const normalized = email.trim().toLowerCase();

  try {
    if (isDevBypassEnabled() && String(otp).trim() === DEV_OTP) {
      await db
        .delete(otpChallenges)
        .where(
          and(eq(otpChallenges.identifier, normalized), eq(otpChallenges.purpose, "login"))
        );
      await issueSession(res, normalized);
      return;
    }

    const rows = await db
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.identifier, normalized),
          eq(otpChallenges.purpose, "login"),
          isNull(otpChallenges.consumedAt)
        )
      )
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);

    const row = rows[0];
    if (!row) {
      res.status(400).json({ error: "No verification code found. Please request a new one." });
      return;
    }

    if (Date.now() > new Date(row.expiresAt).getTime()) {
      res.status(400).json({ error: "This code has expired. Please request a new one." });
      return;
    }

    if (row.attempts >= row.maxAttempts) {
      res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });
      return;
    }

    if (row.codeHash !== sha256Hex(String(otp).trim())) {
      await db
        .update(otpChallenges)
        .set({ attempts: row.attempts + 1 })
        .where(eq(otpChallenges.id, row.id));
      res.status(400).json({ error: "Invalid code. Please check and try again." });
      return;
    }

    await db
      .update(otpChallenges)
      .set({ consumedAt: new Date().toISOString() })
      .where(eq(otpChallenges.id, row.id));

    await issueSession(res, normalized);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Verification failed" });
  }
});

authRouter.post("/guest", async (_req, res) => {
  const GUEST_EMAIL = "guest@fightfind.dev";
  try {
    let user = (
      await db.select().from(users).where(eq(users.email, GUEST_EMAIL)).limit(1)
    )[0];

    if (!user) {
      const created = await db
        .insert(users)
        .values({ email: GUEST_EMAIL, name: "Guest Fighter", phone: "+910000000000", isGuest: true })
        .returning();
      user = created[0]!;

      const profile = (
        await db
          .insert(fighterProfiles)
          .values({
            userId: user.id,
            name: "Guest Fighter",
            city: "Bengaluru",
            state: "Karnataka",
            latitude: 12.9716,
            longitude: 77.5946,
            ageYears: 25,
            yearsExperience: 3,
            totalAmateurFights: 5,
            totalProFights: 0,
            weightClass: "lightweight",
            skillLevel: "intermediate",
            bio: "Just browsing FightFind as a guest.",
          })
          .returning()
      )[0]!;

      await db.insert(fighterDisciplines).values([
        { fighterId: profile.id, discipline: "boxing" },
        { fighterId: profile.id, discipline: "mma" },
      ]);
    }

    const token = `local_guest_${randomUUID()}`;
    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });

    const fighter = await getFighterById(user.id);
    res.json({ access_token: token, fighter });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Guest login failed" });
  }
});
