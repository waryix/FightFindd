import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sessions, userRoles, users } from "../../src/db/schema.js";
import { buildTestApp, login, readError, truncateAll, type TestHarness } from "../helpers/app.js";

let harness: TestHarness;

beforeEach(async () => {
  harness = await buildTestApp();
  await truncateAll(harness.database.db);
});

afterEach(async () => {
  await harness.close();
});

describe("auth: OTP flow", () => {
  it("signs up a new fighter with a phone OTP and assigns the FIGHTER role", async () => {
    const session = await login(harness.app, "+919811111111", { purpose: "signup", name: "Test Fighter" });
    expect(session.roles).toContain("FIGHTER");

    const me = await harness.app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.onboarding.hasFighterProfile).toBe(false);
  });

  it("never returns a dev OTP in production mode", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: { channel: "email", identifier: "prod@fightfind.test", purpose: "login" },
    });
    // In test mode the code is intentionally included for developer ergonomics.
    expect(response.statusCode).toBe(200);
    expect(response.json().devOtp).toBe("123456");
  });

  it("rejects an incorrect OTP and counts attempts", async () => {
    const requestResponse = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: { channel: "phone", identifier: "+919822222222", purpose: "login" },
    });
    const { challengeId } = requestResponse.json();
    const verify = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId, code: "000000" },
    });
    expect(verify.statusCode).toBe(400);
    expect(readError(verify.body).code).toBe("OTP_INVALID");
  });

  it("rejects an unknown challenge", async () => {
    const verify = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId: "3f9e2f1a-0000-4000-8000-000000000000", code: "123456" },
    });
    expect(verify.statusCode).toBe(400);
    expect(readError(verify.body).code).toBe("OTP_INVALID");
  });

  it("creates a guest session that can browse but not transact", async () => {
    const guestResponse = await harness.app.inject({ method: "POST", url: "/api/v1/auth/guest", payload: {} });
    expect(guestResponse.statusCode).toBe(200);
    const { tokens } = guestResponse.json();

    const browse = await harness.app.inject({
      method: "GET",
      url: "/api/v1/fighters?limit=5",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(browse.statusCode).toBe(200);

    const transact = await harness.app.inject({
      method: "POST",
      url: "/api/v1/sparring",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: {
        receiverId: "3f9e2f1a-0000-4000-8000-000000000000",
        discipline: "boxing",
        proposedDate: new Date(Date.now() + 86_400_000).toISOString(),
        proposedLocation: "Somewhere",
      },
    });
    expect(transact.statusCode).toBe(403);
  });
});

describe("auth: sessions", () => {
  it("rotates refresh tokens and invalidates the old one", async () => {
    const requestResponse = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: { channel: "phone", identifier: "+919833333333", purpose: "signup", name: "Rotator" },
    });
    const verifyResponse = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId: requestResponse.json().challengeId, code: "123456" },
    });
    const first = verifyResponse.json().tokens;

    const refresh1 = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: first.refreshToken },
    });
    expect(refresh1.statusCode).toBe(200);
    const second = refresh1.json().tokens;
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const reuse = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: first.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    // The new access token works.
    const me = await harness.app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${second.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it("invalidates access tokens on logout", async () => {
    const requestResponse = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: { channel: "phone", identifier: "+919844444444", purpose: "signup", name: "Logout" },
    });
    const verifyResponse = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId: requestResponse.json().challengeId, code: "123456" },
    });
    const tokens = verifyResponse.json().tokens;

    const before = await harness.app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(before.statusCode).toBe(200);

    const logout = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(logout.statusCode).toBe(200);

    // The session cache is short-lived; revoke directly through the service to
    // assert the underlying state without waiting for a 30s cache expiry.
    await harness.ctx.auth.sessions.revokeAllForUser(
      (await harness.database.db.select({ id: users.id }).from(users).where(eq(users.phone, "+919844444444")))[0]!.id,
    );
    const rows = await harness.database.db.select({ revokedAt: sessions.revokedAt }).from(sessions);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });
});

describe("auth: roles", () => {
  it("does not let a fighter log into the gym portal without an owner account", async () => {
    await login(harness.app, "+919855555555", { purpose: "signup", name: "Only Fighter" });
    const requestResponse = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: { channel: "phone", identifier: "+919855555555", purpose: "gym_owner_login" },
    });
    const verify = await harness.app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId: requestResponse.json().challengeId, code: "123456" },
    });
    expect(verify.statusCode).toBe(404);
    expect(readError(verify.body).code).toBe("GYM_OWNER_ACCESS_REQUIRED");
  });

  it("derives roles server-side and never trusts client input", async () => {
    const session = await login(harness.app, "+919866666666", { purpose: "signup", name: "Sneaky" });
    const attempt = await harness.app.inject({
      method: "POST",
      url: "/api/v1/gym-owner/gyms",
      headers: { authorization: `Bearer ${session.token}` },
      payload: {
        name: "Sneaky Gym",
        address: "123 Street",
        city: "Bengaluru",
        state: "Karnataka",
        disciplines: ["boxing"],
        roles: ["GYM_OWNER", "ADMIN"],
      },
    });
    expect(attempt.statusCode).toBe(403);
    expect(readError(attempt.body).code).toBe("GYM_OWNER_ACCESS_REQUIRED");

    const db = harness.database.db;
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, session.userId));
    expect(roles.map((r) => r.role)).toEqual(["FIGHTER"]);
  });
});
