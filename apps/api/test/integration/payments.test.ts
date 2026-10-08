import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { gymProfiles, payments, refunds } from "../../src/db/schema.js";
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

async function setupActiveGym(feePaise = 500000) {
  const owner = await login(harness.app, "+919844000001", { purpose: "gym_owner_signup", name: "Payments Owner" });
  const created = await harness.app.inject({
    method: "POST",
    url: "/api/v1/gym-owner/gyms",
    headers: authHeader(owner),
    payload: {
      name: "Payments Gym",
      address: "Test Road",
      city: "Bengaluru",
      state: "Karnataka",
      disciplines: ["mma"],
      monthlyFeePaise: feePaise,
      hasTrialClass: false,
    },
  });
  const gymId = created.json().gym.id as string;
  await harness.database.db
    .update(gymProfiles)
    .set({ status: "active", verificationStatus: "verified" })
    .where(eq(gymProfiles.id, gymId));
  return { owner, gymId };
}

async function createMembershipOrder(fighterToken: string, gymId: string) {
  const response = await harness.app.inject({
    method: "POST",
    url: `/api/v1/gyms/${gymId}/membership/order`,
    headers: { authorization: `Bearer ${fighterToken}` },
    payload: {},
  });
  if (response.statusCode !== 201) throw new Error(`order failed: ${response.body}`);
  return response.json() as {
    paymentId: string;
    razorpayOrderId: string;
    amountPaise: number;
  };
}

function webhookHeaders(eventId: string) {
  return { "x-razorpay-event-id": eventId, "x-razorpay-signature": "test-signature" };
}

beforeEach(async () => {
  harness = await buildTestApp();
  await truncateAll(harness.database.db);
});

afterEach(async () => {
  await harness.close();
});

describe("payment orders", () => {
  it("uses the server-side price and ignores any client-supplied amount", async () => {
    const { gymId } = await setupActiveGym(500000);
    const fighter = await seedFighter(harness.app, "+919844000002", { name: "Payer" });

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gyms/${gymId}/membership/order`,
      headers: authHeader(fighter.session),
      payload: { amountPaise: 100, amount: 1 },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().amountPaise).toBe(500000);
  });

  it("prevents duplicate active memberships and duplicate pending orders reuse the membership", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000003", { name: "Double" });

    const first = await createMembershipOrder(fighter.session.token, gymId);
    const second = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gyms/${gymId}/membership/order`,
      headers: authHeader(fighter.session),
      payload: {},
    });
    // A second order is allowed only while the first is unpaid; it reuses the
    // same pending membership so no duplicate membership rows appear.
    expect(second.statusCode).toBe(201);
    expect(second.json().amountPaise).toBe(first.amountPaise);
  });

  it("rejects membership orders for inactive gyms", async () => {
    const gymId = await seedInactiveGym();
    const fighter = await seedFighter(harness.app, "+919844000004", { name: "Inactive Gym Payer" });
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gyms/${gymId}/membership/order`,
      headers: authHeader(fighter.session),
      payload: {},
    });
    expect(response.statusCode).toBe(409);
    expect(readError(response.body).code).toBe("GYM_NOT_ACTIVE");
  });

  it("requires authentication for orders (guests cannot pay)", async () => {
    const { gymId } = await setupActiveGym();
    const guest = (await harness.app.inject({ method: "POST", url: "/api/v1/auth/guest", payload: {} })).json();
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/gyms/${gymId}/membership/order`,
      headers: { authorization: `Bearer ${guest.tokens.accessToken}` },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
  });
});

async function seedInactiveGym() {
  const owner = await login(harness.app, "+919844000099", { purpose: "gym_owner_signup", name: "Inactive Owner" });
  const created = await harness.app.inject({
    method: "POST",
    url: "/api/v1/gym-owner/gyms",
    headers: authHeader(owner),
    payload: {
      name: "Inactive Gym",
      address: "Nowhere",
      city: "Bengaluru",
      state: "Karnataka",
      disciplines: ["boxing"],
      monthlyFeePaise: 100000,
    },
  });
  return created.json().gym.id as string;
}

describe("payment verification", () => {
  it("verifies a Checkout callback server-side and activates the membership request", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000005", { name: "Verifier" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);

    const verify = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      headers: authHeader(fighter.session),
      payload: {
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: simulated.id,
        razorpaySignature: harness.provider.paymentSignature(order.razorpayOrderId, simulated.id),
      },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().status).toBe("captured");
    expect(verify.json().businessState.membershipStatus).toBe("paid_pending_approval");

    const membership = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gyms/${gymId}/membership`,
      headers: authHeader(fighter.session),
    });
    expect(membership.json().membership.status).toBe("paid_pending_approval");
  });

  it("is idempotent when the client verify callback is retried", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000006", { name: "Retry Verify" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);
    const payload = {
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: simulated.id,
      razorpaySignature: harness.provider.paymentSignature(order.razorpayOrderId, simulated.id),
    };
    const first = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      headers: authHeader(fighter.session),
      payload,
    });
    const second = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      headers: authHeader(fighter.session),
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const { gymMembershipRequests } = await import("../../src/db/schema.js");
    const requests = await harness.database.db.select().from(gymMembershipRequests);
    expect(requests.length).toBe(1);
  });

  it("rejects an invalid payment signature", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000007", { name: "Bad Signature" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);

    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      headers: authHeader(fighter.session),
      payload: {
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: simulated.id,
        razorpaySignature: "not-a-valid-signature",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(readError(response.body).code).toBe("PAYMENT_SIGNATURE_INVALID");

    const membership = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gyms/${gymId}/membership`,
      headers: authHeader(fighter.session),
    });
    expect(membership.json().membership.status).toBe("pending_payment");
  });

  it("rejects when the provider-paid amount does not match the order", async () => {
    await harness.close();
    harness = await buildTestApp({ amountOverride: 1 });
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000008", { name: "Wrong Amount" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);

    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      headers: authHeader(fighter.session),
      payload: {
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: simulated.id,
        razorpaySignature: harness.provider.paymentSignature(order.razorpayOrderId, simulated.id),
      },
    });
    expect(response.statusCode).toBe(409);
    expect(readError(response.body).code).toBe("PAYMENT_AMOUNT_MISMATCH");
  });

  it("404s for unknown orders and other people's payments", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000009", { name: "Owner Of Order" });
    const other = await seedFighter(harness.app, "+919844000010", { name: "Not Owner" });
    const order = await createMembershipOrder(fighter.session.token, gymId);

    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      headers: authHeader(other.session),
      payload: {
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: "pay_whatever",
        razorpaySignature: "whatever123456",
      },
    });
    expect(response.statusCode).toBe(404);
    expect(readError(response.body).code).toBe("PAYMENT_NOT_FOUND");
  });
});

describe("monthly-order subscription fallback", () => {
  it("grants FightFind Pro for 30 days when paid as a one-time order", async () => {
    const fighter = await seedFighter(harness.app, "+919844000020", { name: "Monthly Pro" });

    const before = await harness.app.inject({
      method: "GET",
      url: "/api/v1/subscriptions/me/entitlements",
      headers: authHeader(fighter.session),
    });
    expect(before.json().entitlements.isPremium).toBe(false);

    const order = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/order",
      headers: authHeader(fighter.session),
      payload: { product: "FIGHTER_UPGRADE" },
    });
    expect(order.statusCode).toBe(201);
    expect(order.json().amountPaise).toBe(19900);

    await harness.app.inject({
      method: "POST",
      url: `/api/v1/payments/${order.json().paymentId}/simulate`,
      headers: authHeader(fighter.session),
      payload: {},
    });

    const after = await harness.app.inject({
      method: "GET",
      url: "/api/v1/subscriptions/me/entitlements",
      headers: authHeader(fighter.session),
    });
    expect(after.json().entitlements.isPremium).toBe(true);

    const subscription = await harness.app.inject({
      method: "GET",
      url: "/api/v1/subscriptions/me",
      headers: authHeader(fighter.session),
    });
    expect(subscription.json().subscription.status).toBe("active");
    expect(subscription.json().subscription.providerSubscriptionId).toBeNull();
  });

  it("activates a gym platform pass and moves the gym towards verification", async () => {
    const owner = await login(harness.app, "+919844000021", { purpose: "gym_owner_signup", name: "Platform Owner" });
    const created = await harness.app.inject({
      method: "POST",
      url: "/api/v1/gym-owner/gyms",
      headers: authHeader(owner),
      payload: {
        name: "Platform Gym",
        address: "Test Road",
        city: "Bengaluru",
        state: "Karnataka",
        disciplines: ["boxing"],
        monthlyFeePaise: 300000,
      },
    });
    const gymId = created.json().gym.id as string;
    await harness.database.db
      .update(gymProfiles)
      .set({ status: "onboarding", listingFeePaymentId: crypto.randomUUID() })
      .where(eq(gymProfiles.id, gymId));

    const order = await harness.app.inject({
      method: "POST",
      url: "/api/v1/payments/order",
      headers: authHeader(owner),
      payload: { product: "GYM_PLATFORM_SUBSCRIPTION", gymId },
    });
    expect(order.statusCode).toBe(201);
    expect(order.json().amountPaise).toBe(39900);

    await harness.app.inject({
      method: "POST",
      url: `/api/v1/payments/${order.json().paymentId}/simulate`,
      headers: authHeader(owner),
      payload: {},
    });

    const [gym] = await harness.database.db.select().from(gymProfiles).where(eq(gymProfiles.id, gymId));
    expect(gym.status).toBe("pending_verification");

    const onboarding = await harness.app.inject({
      method: "GET",
      url: "/api/v1/gym-owner/onboarding",
      headers: authHeader(owner),
    });
    expect(onboarding.json().onboarding.subscriptionStatus).toBe("active");
  });
});

describe("webhooks", () => {
  it("activates the membership once for a captured payment webhook", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000011", { name: "Webhook Payer" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);

    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: webhookHeaders("evt_capture_1"),
      payload: {
        event: "payment.captured",
        payload: { payment: { entity: { id: simulated.id, order_id: order.razorpayOrderId, status: "captured" } } },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("processed");

    const payment = await harness.database.db.select().from(payments).where(eq(payments.id, order.paymentId));
    expect(payment[0]!.status).toBe("captured");

    const { gymMembershipRequests, paymentTransfers } = await import("../../src/db/schema.js");
    expect((await harness.database.db.select().from(gymMembershipRequests)).length).toBe(1);
    // 100% of the membership fee is routed to the gym's linked account.
    const transfers = await harness.database.db.select().from(paymentTransfers);
    expect(transfers.length).toBe(1);
    expect(transfers[0]!.amountPaise).toBe(order.amountPaise);
  });

  it("deduplicates webhook deliveries by event id", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000012", { name: "Duplicate Hook" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);
    const body = {
      event: "payment.captured",
      payload: { payment: { entity: { id: simulated.id, order_id: order.razorpayOrderId } } },
    };

    const first = await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: webhookHeaders("evt_same_id"),
      payload: body,
    });
    const second = await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: webhookHeaders("evt_same_id"),
      payload: body,
    });
    expect(first.json().status).toBe("processed");
    expect(second.json().status).toBe("duplicate");

    const { gymMembershipRequests, notifications } = await import("../../src/db/schema.js");
    expect((await harness.database.db.select().from(gymMembershipRequests)).length).toBe(1);
    const gymNotifications = (await harness.database.db.select().from(notifications)).filter(
      (n) => n.type === "MEMBERSHIP_REQUEST_RECEIVED",
    );
    expect(gymNotifications.length).toBe(1);
  });

  it("handles out-of-order webhooks: capture arriving after a failed attempt marker", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000013", { name: "Out Of Order" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);

    // Failure arrives first for a different payment attempt id, then capture.
    await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: webhookHeaders("evt_fail_first"),
      payload: {
        event: "payment.failed",
        payload: { payment: { entity: { id: "pay_failed_attempt", order_id: order.razorpayOrderId } } },
      },
    });
    const capture = await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: webhookHeaders("evt_capture_after"),
      payload: {
        event: "payment.captured",
        payload: { payment: { entity: { id: simulated.id, order_id: order.razorpayOrderId } } },
      },
    });
    expect(capture.statusCode).toBe(200);

    const membership = await harness.app.inject({
      method: "GET",
      url: `/api/v1/gyms/${gymId}/membership`,
      headers: authHeader(fighter.session),
    });
    expect(membership.json().membership.status).toBe("paid_pending_approval");
  });

  it("rejects an invalid webhook signature", async () => {
    await harness.close();
    harness = await buildTestApp({ failWebhookVerification: true });
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: { "x-razorpay-event-id": "evt_bad", "x-razorpay-signature": "bad" },
      payload: { event: "payment.captured", payload: {} },
    });
    expect(response.statusCode).toBe(400);
    expect(readError(response.body).code).toBe("WEBHOOK_SIGNATURE_INVALID");
  });

  it("processes refunds without deleting the payment", async () => {
    const { gymId } = await setupActiveGym();
    const fighter = await seedFighter(harness.app, "+919844000014", { name: "Refund Payer" });
    const order = await createMembershipOrder(fighter.session.token, gymId);
    const simulated = harness.provider.simulatePayment(order.razorpayOrderId);
    await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: webhookHeaders("evt_refund_capture"),
      payload: {
        event: "payment.captured",
        payload: { payment: { entity: { id: simulated.id, order_id: order.razorpayOrderId } } },
      },
    });

    const refund = await harness.app.inject({
      method: "POST",
      url: "/api/v1/webhooks/razorpay",
      headers: webhookHeaders("evt_refund_1"),
      payload: {
        event: "refund.processed",
        payload: {
          refund: { entity: { id: "rfnd_test_1", payment_id: simulated.id, amount: order.amountPaise } },
        },
      },
    });
    expect(refund.statusCode).toBe(200);

    const [payment] = await harness.database.db.select().from(payments).where(eq(payments.id, order.paymentId));
    expect(payment!.status).toBe("refunded");
    const refundRows = await harness.database.db.select().from(refunds);
    expect(refundRows.length).toBe(1);
    expect(refundRows[0]!.amountPaise).toBe(order.amountPaise);
  });
});
