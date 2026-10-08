import { describe, expect, it } from "vitest";
import {
  canTransitionGym,
  canTransitionMembership,
  canTransitionSparring,
  mapProviderSubscriptionStatus,
  sparringTransitionActor,
} from "./state-machines.js";

describe("sparring transitions", () => {
  it("allows pending -> accepted/declined/cancelled", () => {
    expect(canTransitionSparring("pending", "accepted")).toBe(true);
    expect(canTransitionSparring("pending", "declined")).toBe(true);
    expect(canTransitionSparring("pending", "cancelled")).toBe(true);
  });
  it("allows accepted -> completed/cancelled", () => {
    expect(canTransitionSparring("accepted", "completed")).toBe(true);
    expect(canTransitionSparring("accepted", "cancelled")).toBe(true);
  });
  it("forbids terminal transitions", () => {
    expect(canTransitionSparring("declined", "accepted")).toBe(false);
    expect(canTransitionSparring("completed", "pending")).toBe(false);
    expect(canTransitionSparring("cancelled", "accepted")).toBe(false);
  });
  it("assigns accept/decline to the receiver", () => {
    expect(sparringTransitionActor("accepted")).toBe("receiver");
    expect(sparringTransitionActor("declined")).toBe("receiver");
    expect(sparringTransitionActor("cancelled")).toBe("either");
  });
});

describe("membership transitions", () => {
  it("follows the paid flow", () => {
    expect(canTransitionMembership("pending_payment", "paid_pending_approval")).toBe(true);
    expect(canTransitionMembership("paid_pending_approval", "active")).toBe(true);
    expect(canTransitionMembership("active", "expired")).toBe(true);
  });
  it("supports rejection and refund", () => {
    expect(canTransitionMembership("paid_pending_approval", "rejected")).toBe(true);
    expect(canTransitionMembership("rejected", "refunded")).toBe(true);
  });
  it("forbids reactivating expired memberships", () => {
    expect(canTransitionMembership("expired", "active")).toBe(false);
  });
  it("forbids activating before payment", () => {
    expect(canTransitionMembership("pending_payment", "active")).toBe(false);
  });
});

describe("gym listing transitions", () => {
  it("follows onboarding to active", () => {
    expect(canTransitionGym("draft", "awaiting_listing_payment")).toBe(true);
    expect(canTransitionGym("awaiting_listing_payment", "onboarding")).toBe(true);
    expect(canTransitionGym("onboarding", "pending_verification")).toBe(true);
    expect(canTransitionGym("pending_verification", "active")).toBe(true);
  });
  it("supports verification failure and suspension", () => {
    expect(canTransitionGym("pending_verification", "verification_rejected")).toBe(true);
    expect(canTransitionGym("active", "suspended")).toBe(true);
    expect(canTransitionGym("suspended", "active")).toBe(true);
  });
  it("forbids skipping payment", () => {
    expect(canTransitionGym("draft", "active")).toBe(false);
  });
});

describe("provider subscription mapping", () => {
  it("maps active-ish states", () => {
    expect(mapProviderSubscriptionStatus("active")).toBe("active");
    expect(mapProviderSubscriptionStatus("authenticated")).toBe("active");
    expect(mapProviderSubscriptionStatus("resumed")).toBe("active");
  });
  it("maps pending-ish states", () => {
    expect(mapProviderSubscriptionStatus("created")).toBe("pending");
    expect(mapProviderSubscriptionStatus("pending")).toBe("pending");
    expect(mapProviderSubscriptionStatus("paused")).toBe("pending");
  });
  it("maps terminal states", () => {
    expect(mapProviderSubscriptionStatus("halted")).toBe("halted");
    expect(mapProviderSubscriptionStatus("cancelled")).toBe("cancelled");
    expect(mapProviderSubscriptionStatus("completed")).toBe("expired");
    expect(mapProviderSubscriptionStatus("expired")).toBe("expired");
  });
  it("treats unknown states as payment_failed", () => {
    expect(mapProviderSubscriptionStatus("weird_state")).toBe("payment_failed");
    expect(mapProviderSubscriptionStatus(null)).toBe("payment_failed");
  });
});
