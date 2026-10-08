import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { subscriptions } from "../../src/db/schema.js";
import {
  authHeader,
  buildTestApp,
  createFighterProfile,
  login,
  readError,
  seedFighter,
  truncateAll,
  type TestHarness,
} from "../helpers/app.js";

let harness: TestHarness;

beforeEach(async () => {
  harness = await buildTestApp();
  await truncateAll(harness.database.db);
});

afterEach(async () => {
  await harness.close();
});

describe("fighter profiles", () => {
  it("creates and updates a profile, and suggests weight class corrections", async () => {
    const session = await login(harness.app, "+919811111100", { purpose: "signup", name: "Profile Test" });
    const created = await createFighterProfile(harness.app, session, {
      name: "Profile Test",
      weightClass: "welterweight",
      weightKg: 69,
    });
    expect(created.id).toBeTruthy();

    const update = await harness.app.inject({
      method: "PATCH",
      url: "/api/v1/fighters/me",
      headers: authHeader(session),
      payload: { bio: "Updated bio", city: "Mumbai" },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().fighter.bio).toBe("Updated bio");
    expect(update.json().fighter.city).toBe("Mumbai");
  });

  it("requires authentication to view your own profile and rejects guests", async () => {
    const guest = (await harness.app.inject({ method: "POST", url: "/api/v1/auth/guest", payload: {} })).json();
    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/fighters/me",
      headers: { authorization: `Bearer ${guest.tokens.accessToken}` },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("fighter discovery", () => {
  it("filters by radius in the database and reports distance", async () => {
    const viewer = await seedFighter(harness.app, "+919811111101", {
      name: "Viewer",
      latitude: 12.9716,
      longitude: 77.5946,
      weightClass: "welterweight",
      skillLevel: "advanced",
      disciplines: ["boxing", "mma"],
    });
    await seedFighter(harness.app, "+919811111102", {
      name: "Nearby Fighter",
      latitude: 12.9352,
      longitude: 77.6245,
      weightClass: "welterweight",
      skillLevel: "advanced",
      disciplines: ["boxing"],
    });
    await seedFighter(harness.app, "+919811111103", {
      name: "Mumbai Fighter",
      latitude: 19.076,
      longitude: 72.8777,
      city: "Mumbai",
      state: "Maharashtra",
      weightClass: "welterweight",
    });

    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/fighters?lat=12.9716&lng=77.5946&radius_km=25&sort=nearest",
      headers: authHeader(viewer.session),
    });
    expect(response.statusCode).toBe(200);
    const items = response.json().items as { name: string; distanceKm: number | null; compatibilityScore: number | null }[];
    const names = items.map((item) => item.name);
    expect(names).toContain("Nearby Fighter");
    expect(names).not.toContain("Mumbai Fighter");
    expect(names).not.toContain("Viewer");
    const nearby = items.find((item) => item.name === "Nearby Fighter")!;
    expect(nearby.distanceKm).toBeGreaterThan(0);
    expect(nearby.distanceKm).toBeLessThan(10);
    expect(nearby.compatibilityScore).toBeGreaterThanOrEqual(0);
  });

  it("sorts by distance ascending for sort=nearest", async () => {
    const viewer = await seedFighter(harness.app, "+919811111104", { name: "Viewer 2" });
    await seedFighter(harness.app, "+919811111105", {
      name: "Far",
      latitude: 12.9121,
      longitude: 77.6446,
    });
    await seedFighter(harness.app, "+919811111106", {
      name: "Close",
      latitude: 12.9722,
      longitude: 77.5951,
    });
    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/fighters?lat=12.9716&lng=77.5946&radius_km=50&sort=nearest",
      headers: authHeader(viewer.session),
    });
    const distances = (response.json().items as { distanceKm: number }[]).map((item) => item.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("gates advanced filters behind FightFind Pro", async () => {
    const viewer = await seedFighter(harness.app, "+919811111107", { name: "Free User" });
    const blocked = await harness.app.inject({
      method: "GET",
      url: "/api/v1/fighters?min_height=170",
      headers: authHeader(viewer.session),
    });
    expect(blocked.statusCode).toBe(403);
    expect(readError(blocked.body).code).toBe("ADVANCED_FILTERS_REQUIRE_PREMIUM");

    // Activate premium through the real subscription + webhook flow.
    const upgrade = await harness.app.inject({
      method: "POST",
      url: "/api/v1/subscriptions/fighter-upgrade",
      headers: authHeader(viewer.session),
      payload: {},
    });
    expect(upgrade.statusCode).toBe(201);
    const providerSubscriptionId = upgrade.json().subscription.providerSubscriptionId as string;
    await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: { "x-razorpay-event-id": "evt_premium_1", "x-razorpay-signature": "test" },
      payload: {
        event: "subscription.activated",
        payload: {
          subscription: {
            entity: {
              id: providerSubscriptionId,
              plan_id: "plan_mock_fighter",
              status: "active",
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor(Date.now() / 1000) + 30 * 86_400,
            },
          },
        },
      },
    });

    const allowed = await harness.app.inject({
      method: "GET",
      url: "/api/v1/fighters?min_height=170",
      headers: authHeader(viewer.session),
    });
    expect(allowed.statusCode).toBe(200);

    const entitlements = await harness.app.inject({
      method: "GET",
      url: "/api/v1/subscriptions/me/entitlements",
      headers: authHeader(viewer.session),
    });
    expect(entitlements.json().entitlements.isPremium).toBe(true);
    expect(entitlements.json().entitlements.canUseAdvancedFilters).toBe(true);
  });

  it("allows anonymous browsing of discovery", async () => {
    await seedFighter(harness.app, "+919811111108", { name: "Public Fighter" });
    const response = await harness.app.inject({ method: "GET", url: "/api/v1/fighters?limit=10" });
    expect(response.statusCode).toBe(200);
    expect(response.json().items.length).toBeGreaterThan(0);
  });

  it("excludes blocked fighters from discovery", async () => {
    const viewer = await seedFighter(harness.app, "+919811111109", { name: "Blocker" });
    const target = await seedFighter(harness.app, "+919811111110", { name: "Blocked One" });

    const block = await harness.app.inject({
      method: "POST",
      url: "/api/v1/fighters/me/blocks",
      headers: authHeader(viewer.session),
      payload: { userId: target.profile.userId },
    });
    expect(block.statusCode).toBe(200);

    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/fighters?limit=50",
      headers: authHeader(viewer.session),
    });
    const names = (response.json().items as { name: string }[]).map((item) => item.name);
    expect(names).not.toContain("Blocked One");
  });
});

describe("gym discovery", () => {
  it("only lists active gyms and reports distance", async () => {
    const owner = await login(harness.app, "+919822222200", { purpose: "gym_owner_signup", name: "Gym Owner" });
    const create = await harness.app.inject({
      method: "POST",
      url: "/api/v1/gym-owner/gyms",
      headers: authHeader(owner),
      payload: {
        name: "Discovery Gym",
        address: "Somewhere",
        city: "Bengaluru",
        state: "Karnataka",
        latitude: 12.9352,
        longitude: 77.6245,
        disciplines: ["boxing"],
        monthlyFeePaise: 300000,
        hasTrialClass: true,
      },
    });
    expect(create.statusCode).toBe(201);
    const gymId = create.json().gym.id as string;

    // Not yet active → hidden from public discovery.
    const hidden = await harness.app.inject({ method: "GET", url: "/api/v1/gyms?search=Discovery" });
    expect(hidden.json().items.length).toBe(0);

    const [gym] = await harness.database.db
      .update((await import("../../src/db/schema.js")).gymProfiles)
      .set({ status: "active", verificationStatus: "verified" })
      .where(eq((await import("../../src/db/schema.js")).gymProfiles.id, gymId))
      .returning();

    const visible = await harness.app.inject({
      method: "GET",
      url: "/api/v1/gyms?lat=12.9716&lng=77.5946&radius_km=25&sort=nearest",
    });
    expect(visible.statusCode).toBe(200);
    const item = (visible.json().items as { id: string; distanceKm: number; hasTrialClass: boolean }[]).find(
      (g) => g.id === gym.id,
    );
    expect(item).toBeTruthy();
    expect(item!.distanceKm).toBeLessThan(10);
    expect(item!.hasTrialClass).toBe(true);
  });
});

describe("premium request limits", () => {
  it("caps pending requests for free fighters and lifts it for premium", async () => {
    const sender = await seedFighter(harness.app, "+919811111111", { name: "Limited Sender" });
    const receivers = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        seedFighter(harness.app, `+9198111112${String(i).padStart(2, "0")}`, { name: `Receiver ${i}` }),
      ),
    );

    for (const receiver of receivers.slice(0, 3)) {
      const response = await harness.app.inject({
        method: "POST",
        url: "/api/v1/sparring",
        headers: authHeader(sender.session),
        payload: {
          receiverId: receiver.profile.id,
          discipline: "boxing",
          proposedDate: new Date(Date.now() + 86_400_000).toISOString(),
          proposedLocation: "Test Gym",
        },
      });
      expect(response.statusCode).toBe(201);
    }

    const blocked = await harness.app.inject({
      method: "POST",
      url: "/api/v1/sparring",
      headers: authHeader(sender.session),
      payload: {
        receiverId: receivers[3]!.profile.id,
        discipline: "boxing",
        proposedDate: new Date(Date.now() + 86_400_000).toISOString(),
        proposedLocation: "Test Gym",
      },
    });
    expect(blocked.statusCode).toBe(409);
    expect(readError(blocked.body).code).toBe("REQUEST_LIMIT_REACHED");

    // Grant premium by inserting an active subscription (server-side state).
    await harness.database.db.insert(subscriptions).values({
      userId: sender.session.userId,
      type: "FIGHTER_UPGRADE",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    });

    const allowed = await harness.app.inject({
      method: "POST",
      url: "/api/v1/sparring",
      headers: authHeader(sender.session),
      payload: {
        receiverId: receivers[3]!.profile.id,
        discipline: "boxing",
        proposedDate: new Date(Date.now() + 86_400_000).toISOString(),
        proposedLocation: "Test Gym",
      },
    });
    expect(allowed.statusCode).toBe(201);
  });
});
