import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { gymMemberships, gymProfiles, subscriptions } from "../../src/db/schema.js";
import {
  authHeader,
  buildTestApp,
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

async function signupOwner(phone: string, name = "Owner") {
  return login(harness.app, phone, { purpose: "gym_owner_signup", name });
}

async function createGym(ownerToken: string, overrides: Record<string, unknown> = {}) {
  const response = await harness.app.inject({
    method: "POST",
    url: "/api/v1/gym-owner/gyms",
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {
      name: "Onboarding Gym",
      address: "100 Feet Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560095",
      latitude: 12.9352,
      longitude: 77.6245,
      disciplines: ["mma", "bjj"],
      monthlyFeePaise: 450000,
      hasTrialClass: true,
      timings: "Mon-Sat 6-9pm",
      description: "Test gym",
      ...overrides,
    },
  });
  if (response.statusCode !== 201) throw new Error(`create gym failed: ${response.body}`);
  return response.json().gym as { id: string };
}

async function activateGymCompletely(ownerToken: string, gymId: string) {
  // Razorpay linked account.
  await harness.app.inject({
    method: "POST",
    url: `/api/v1/gym-owner/gyms/${gymId}/razorpay-account`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {},
  });
  // Listing fee.
  const listing = await harness.app.inject({
    method: "POST",
    url: `/api/v1/gym-owner/gyms/${gymId}/listing-fee/order`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {},
  });
  if (listing.statusCode !== 201) throw new Error(`listing order failed: ${listing.body}`);
  const listingOrder = listing.json();
  await harness.app.inject({
    method: "POST",
    url: `/api/v1/payments/${listingOrder.paymentId}/simulate`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {},
  });
  // Platform subscription + activation webhook.
  const subscription = await harness.app.inject({
    method: "POST",
    url: "/api/v1/subscriptions/gym-platform",
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { gymId },
  });
  if (subscription.statusCode !== 201) throw new Error(`subscription failed: ${subscription.body}`);
  const providerSubscriptionId = subscription.json().subscription.providerSubscriptionId as string;
  await harness.app.inject({
    method: "POST",
    url: "/api/v1/webhooks/razorpay",
    headers: { "x-razorpay-event-id": `evt_gym_activate_${gymId}`, "x-razorpay-signature": "test" },
    payload: {
      event: "subscription.activated",
      payload: {
        subscription: {
          entity: {
            id: providerSubscriptionId,
            plan_id: "plan_mock_gym",
            status: "active",
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86_400,
          },
        },
      },
    },
  });
}

async function verifyGymThroughAdmin(gymId: string, phone: string) {
  const admin = await createAdminAndLogin(phone);
  const response = await harness.app.inject({
    method: "POST",
    url: `/api/v1/admin/gyms/${gymId}/verification`,
    headers: authHeader(admin),
    payload: { status: "verified" },
  });
  if (response.statusCode !== 200) throw new Error(`verify failed: ${response.body}`);
  return admin;
}

describe("gym owner onboarding", () => {
  it("creates a gym-owner account with the GYM_OWNER role via signup", async () => {
    const owner = await signupOwner("+919855000001", "New Owner");
    expect(owner.roles).toContain("GYM_OWNER");

    const onboarding = await harness.app.inject({
      method: "GET",
      url: "/api/v1/gym-owner/onboarding",
      headers: authHeader(owner),
    });
    expect(onboarding.json().onboarding.step).toBe("gym_details");
  });

  it("walks the onboarding steps in order, gating listing payment on Razorpay onboarding", async () => {
    const owner = await signupOwner("+919855000002", "Onboarder");
    const gym = await createGym(owner.token);

    const blocked = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gym-owner/gyms/${gym.id}/listing-fee/order`,
      headers: authHeader(owner),
      payload: {},
    });
    expect(blocked.statusCode).toBe(400);
    expect(readError(blocked.body).code).toBe("LISTING_PAYMENT_REQUIRED");

    const account = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gym-owner/gyms/${gym.id}/razorpay-account`,
      headers: authHeader(owner),
      payload: {},
    });
    expect(account.statusCode).toBe(200);
    expect(account.json().linkedAccountId).toMatch(/^acc_mock_/);

    const listing = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gym-owner/gyms/${gym.id}/listing-fee/order`,
      headers: authHeader(owner),
      payload: {},
    });
    expect(listing.statusCode).toBe(201);
    expect(listing.json().amountPaise).toBe(99900);

    await harness.app.inject({
      method: "POST",
      url: `/api/v1/payments/${listing.json().paymentId}/simulate`,
      headers: authHeader(owner),
      payload: {},
    });

    const [gymRow] = await harness.database.db
      .select()
      .from(gymProfiles)
      .where(eq(gymProfiles.id, gym.id));
    expect(gymRow!.status).toBe("onboarding");
    expect(gymRow!.listingFeePaymentId).toBe(listing.json().paymentId);

    const onboarding = await harness.app.inject({
      method: "GET",
      url: "/api/v1/gym-owner/onboarding",
      headers: authHeader(owner),
    });
    expect(onboarding.json().onboarding.step).toBe("platform_subscription");
    expect(onboarding.json().onboarding.listingPaymentStatus).toBe("paid");
  });

  it("activates the platform subscription via webhook and moves the gym to pending verification", async () => {
    const owner = await signupOwner("+919855000003", "Subscriber");
    const gym = await createGym(owner.token);
    await activateGymCompletely(owner.token, gym.id);

    const [gymRow] = await harness.database.db
      .select()
      .from(gymProfiles)
      .where(eq(gymProfiles.id, gym.id));
    expect(gymRow!.status).toBe("pending_verification");

    const onboarding = await harness.app.inject({
      method: "GET",
      url: "/api/v1/gym-owner/onboarding",
      headers: authHeader(owner),
    });
    expect(onboarding.json().onboarding.step).toBe("verification");
    expect(onboarding.json().onboarding.subscriptionStatus).toBe("active");
  });

  it("enforces ownership on gym-owner endpoints", async () => {
    const ownerA = await signupOwner("+919855000004", "Owner A");
    const ownerB = await signupOwner("+919855000005", "Owner B");
    const gym = await createGym(ownerA.token);

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gym-owner/gyms/${gym.id}/dashboard`,
      headers: authHeader(ownerB),
    });
    expect(response.statusCode).toBe(404);
    expect(readError(response.body).code).toBe("GYM_NOT_OWNER");
  });
});

describe("gym membership requests", () => {
  it("routes a paid membership to the gym owner for approval, then activates it", async () => {
    const owner = await signupOwner("+919855000006", "Approver");
    const gym = await createGym(owner.token);
    await activateGymCompletely(owner.token, gym.id);
    await verifyGymThroughAdmin(gym.id, "+919855000090");

    const fighter = await seedFighter(harness.app, "+919855000007", {
      name: "Applicant",
      skillLevel: "advanced",
      weightClass: "welterweight",
      disciplines: ["mma", "bjj"],
    });

    const order = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gyms/${gym.id}/membership/order`,
      headers: authHeader(fighter.session),
      payload: {},
    });
    const orderBody = order.json();

    // Payment state and membership state are separate: pay first.
    await harness.app.inject({
      method: "POST",
      url: `/api/v1/payments/${orderBody.paymentId}/simulate`,
      headers: authHeader(fighter.session),
      payload: {},
    });

    const requests = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gym-owner/gyms/${gym.id}/requests`,
      headers: authHeader(owner),
    });
    expect(requests.statusCode).toBe(200);
    expect(requests.json().items.length).toBe(1);
    const request = requests.json().items[0];
    expect(request.status).toBe("paid_pending_approval");
    expect(request.fighter.name).toBe("Applicant");
    expect(request.amountPaise).toBe(450000);

    const accept = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gym-owner/memberships/${request.id}/accept`,
      headers: authHeader(owner),
      payload: {},
    });
    expect(accept.statusCode).toBe(200);
    expect(accept.json().membership.status).toBe("active");

    const members = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gym-owner/gyms/${gym.id}/members`,
      headers: authHeader(owner),
    });
    expect(members.json().items.length).toBe(1);
    expect(members.json().items[0].fighter.name).toBe("Applicant");

    const dashboard = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gym-owner/gyms/${gym.id}/dashboard`,
      headers: authHeader(owner),
    });
    const dashboardBody = dashboard.json().dashboard;
    expect(dashboardBody.currentMembers).toBe(1);
    expect(dashboardBody.pendingRequests).toBe(0);
    expect(dashboardBody.monthlyRevenuePaise).toBe(450000);
    expect(dashboardBody.subscription.status).toBe("active");
    expect(dashboardBody.listingFeePaid).toBe(true);

    // The gym-owner payments view separates FightFind fees from membership revenue.
    const paymentsResponse = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gym-owner/gyms/${gym.id}/payments`,
      headers: authHeader(owner),
    });
    const types = (paymentsResponse.json().items as { type: string }[]).map((p) => p.type);
    expect(types).toContain("GYM_LISTING");
    expect(types).toContain("GYM_MEMBERSHIP");
  });

  it("declines a membership request", async () => {
    const owner = await signupOwner("+919855000008", "Decliner");
    const gym = await createGym(owner.token);
    await activateGymCompletely(owner.token, gym.id);
    await verifyGymThroughAdmin(gym.id, "+919855000091");

    const fighter = await seedFighter(harness.app, "+919855000009", { name: "Rejected Applicant" });
    const order = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gyms/${gym.id}/membership/order`,
      headers: authHeader(fighter.session),
      payload: {},
    });
    await harness.app.inject({
      method: "POST",
      url: `/api/v1/payments/${order.json().paymentId}/simulate`,
      headers: authHeader(fighter.session),
      payload: {},
    });
    const requests = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gym-owner/gyms/${gym.id}/requests`,
      headers: authHeader(owner),
    });
    const decline = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gym-owner/memberships/${requests.json().items[0].id}/decline`,
      headers: authHeader(owner),
      payload: {},
    });
    expect(decline.statusCode).toBe(200);
    expect(decline.json().membership.status).toBe("rejected");
  });
});

describe("gym platform subscription lifecycle", () => {
  it("records a failed subscription and suspends the gym after the grace period", async () => {
    const owner = await signupOwner("+919855000010", "Failing Owner");
    const gym = await createGym(owner.token);
    await activateGymCompletely(owner.token, gym.id);
    await verifyGymThroughAdmin(gym.id, "+919855000092");

    const [subscription] = await harness.database.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.gymId, gym.id), eq(subscriptions.type, "GYM_PLATFORM_SUBSCRIPTION")));

    // Provider reports a halted subscription.
    await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: { "x-razorpay-event-id": "evt_gym_halted_1", "x-razorpay-signature": "test" },
      payload: {
        event: "subscription.halted",
        payload: {
          subscription: { entity: { id: subscription!.providerSubscriptionId, status: "halted", plan_id: "plan_mock_gym" } },
        },
      },
    });

    const [afterHalt] = await harness.database.db.select().from(gymProfiles).where(eq(gymProfiles.id, gym.id));
    expect(afterHalt!.subscriptionFailedAt).not.toBeNull();

    // Simulate the grace period lapsing.
    await harness.database.db
      .update(gymProfiles)
      .set({ subscriptionFailedAt: new Date(Date.now() - 30 * 86_400_000) })
      .where(eq(gymProfiles.id, gym.id));

    const admin = await createAdminAndLogin("+919855000099");
    const maintenance = await harness.app.inject({
      method: "POST",
      url: "/api/v1/admin/maintenance/run",
      headers: authHeader(admin),
      payload: {},
    });
    expect(maintenance.statusCode).toBe(200);
    expect(maintenance.json().suspendedGyms).toBeGreaterThanOrEqual(1);

    const [suspended] = await harness.database.db.select().from(gymProfiles).where(eq(gymProfiles.id, gym.id));
    expect(suspended!.status).toBe("suspended");

    const memberships = await harness.database.db
      .select()
      .from(gymMemberships)
      .where(eq(gymMemberships.gymId, gym.id));
    expect(memberships.length).toBe(0);
  });
});

async function createAdminAndLogin(phone: string) {
  const { users, userRoles } = await import("../../src/db/schema.js");
  const [user] = await harness.database.db
    .insert(users)
    .values({ name: "Test Admin", phone })
    .returning();
  await harness.database.db.insert(userRoles).values({ userId: user!.id, role: "ADMIN" });
  return login(harness.app, phone, { purpose: "login", name: "Test Admin" });
}
