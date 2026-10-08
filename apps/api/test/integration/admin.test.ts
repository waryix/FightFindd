import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { gymProfiles, notifications, users, userRoles } from "../../src/db/schema.js";
import {
  authHeader,
  buildTestApp,
  login,

  seedFighter,
  truncateAll,
  type TestHarness,
} from "../helpers/app.js";

let harness: TestHarness;

async function createAdmin(phone: string) {
  const [user] = await harness.database.db
    .insert(users)
    .values({ name: "Admin", phone })
    .returning();
  await harness.database.db.insert(userRoles).values({ userId: user!.id, role: "ADMIN" });
  return login(harness.app, phone, { purpose: "login", name: "Admin" });
}

beforeEach(async () => {
  harness = await buildTestApp();
  await truncateAll(harness.database.db);
});

afterEach(async () => {
  await harness.close();
});

describe("admin authorization", () => {
  it("rejects fighters from admin endpoints", async () => {
    const fighter = await seedFighter(harness.app, "+919866000001", { name: "Not Admin" });
    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/admin/gyms",
      headers: authHeader(fighter.session),
    });
    expect(response.statusCode).toBe(403);
  });

  it("allows admins to list gyms, users, payments and audit logs", async () => {
    const admin = await createAdmin("+919866000002");
    for (const url of [
      "/api/v1/admin/gyms",
      "/api/v1/admin/users",
      "/api/v1/admin/payments",
      "/api/v1/admin/payments/failed",
      "/api/v1/admin/memberships",
      "/api/v1/admin/audit-logs",
    ]) {
      const response = await harness.app.inject({ method: "GET", url, headers: authHeader(admin) });
      expect(response.statusCode, url).toBe(200);
    }
  });
});

describe("gym verification", () => {
  it("verifies a pending gym, lists it publicly, and notifies the owner", async () => {
    const owner = await login(harness.app, "+919866000003", { purpose: "gym_owner_signup", name: "Verify Owner" });
    const created = await harness.app.inject({
      method: "POST",
      url: "/api/v1/gym-owner/gyms",
      headers: authHeader(owner),
      payload: {
        name: "Verify Me Gym",
        address: "Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        disciplines: ["boxing"],
        monthlyFeePaise: 250000,
      },
    });
    const gymId = created.json().gym.id as string;
    await harness.database.db
      .update(gymProfiles)
      .set({ status: "pending_verification" })
      .where(eq(gymProfiles.id, gymId));

    const admin = await createAdmin("+919866000004");
    const verify = await harness.app.inject({
      method: "POST",
      url: `/api/v1/admin/gyms/${gymId}/verification`,
      headers: authHeader(admin),
      payload: { status: "verified" },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().gym.verificationStatus).toBe("verified");
    expect(verify.json().gym.status).toBe("active");

    const ownerNotifications = await harness.database.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, owner.userId));
    expect(ownerNotifications.some((n) => n.type === "LISTING_VERIFIED")).toBe(true);

    const publicList = await harness.app.inject({ method: "GET", url: "/api/v1/gyms?search=Verify Me" });
    expect(publicList.json().items.length).toBe(1);
    expect(publicList.json().items[0].isVerified).toBe(true);
  });

  it("rejects a gym with a reason", async () => {
    const owner = await login(harness.app, "+919866000005", { purpose: "gym_owner_signup", name: "Reject Owner" });
    const created = await harness.app.inject({
      method: "POST",
      url: "/api/v1/gym-owner/gyms",
      headers: authHeader(owner),
      payload: {
        name: "Reject Me Gym",
        address: "Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        disciplines: ["boxing"],
      },
    });
    const gymId = created.json().gym.id as string;
    await harness.database.db
      .update(gymProfiles)
      .set({ status: "pending_verification" })
      .where(eq(gymProfiles.id, gymId));

    const admin = await createAdmin("+919866000006");
    const reject = await harness.app.inject({
      method: "POST",
      url: `/api/v1/admin/gyms/${gymId}/verification`,
      headers: authHeader(admin),
      payload: { status: "rejected", reason: "Documents incomplete" },
    });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().gym.verificationStatus).toBe("rejected");

    const [gym] = await harness.database.db.select().from(gymProfiles).where(eq(gymProfiles.id, gymId));
    expect(gym!.status).toBe("verification_rejected");
  });

  it("suspends an active gym", async () => {
    const admin = await createAdmin("+919866000007");
    const owner = await login(harness.app, "+919866000008", { purpose: "gym_owner_signup", name: "Suspend Owner" });
    const created = await harness.app.inject({
      method: "POST",
      url: "/api/v1/gym-owner/gyms",
      headers: authHeader(owner),
      payload: {
        name: "Suspend Me Gym",
        address: "Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        disciplines: ["boxing"],
      },
    });
    const gymId = created.json().gym.id as string;
    await harness.database.db
      .update(gymProfiles)
      .set({ status: "active", verificationStatus: "verified" })
      .where(eq(gymProfiles.id, gymId));

    const suspend = await harness.app.inject({
      method: "POST",
      url: `/api/v1/admin/gyms/${gymId}/verification`,
      headers: authHeader(admin),
      payload: { status: "suspended", reason: "Policy violation" },
    });
    expect(suspend.statusCode).toBe(200);

    const publicList = await harness.app.inject({ method: "GET", url: "/api/v1/gyms?search=Suspend Me" });
    expect(publicList.json().items.length).toBe(0);
  });
});
