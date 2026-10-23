import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../config/db";
import { gymProfiles, payments, subscriptions, users } from "../db/schema";
import { requireAuth, requireNotGuest } from "../middleware/auth";
import { createOrder, verifySignature, PAYMENTS_MOCK, RAZORPAY_KEY_ID } from "../services/payments";

export const paymentRouter: IRouter = Router();

const PRICES = {
  gym_registration: 100000, // ₹1000 one-time
  gym_monthly: 30000,       // ₹300 / month
  fighter_pro: 10000,       // ₹100 one-time
} as const;

type Purpose = keyof typeof PRICES;

async function saveOrder(
  orderId: string,
  amount: number,
  purpose: Purpose,
  userId: string,
  gymId: string | null = null,
  fighterUserId: string | null = null
) {
  await db.insert(payments).values({
    userId,
    gymId,
    fighterUserId,
    type: purpose,
    amountPaise: amount,
    providerOrderId: orderId,
    status: "created",
  });
}

paymentRouter.get("/config", (_req, res) => {
  res.json({ mock: PAYMENTS_MOCK, keyId: RAZORPAY_KEY_ID || "rzp_test_dummy" });
});

paymentRouter.post("/gym/order", requireAuth, requireNotGuest, async (req, res) => {
  try {
    const amount = PRICES.gym_registration;
    const order = await createOrder(amount, "gym_registration");
    await saveOrder(order.id, amount, "gym_registration", (req as any).user.id);
    res.json({ order, amount, purpose: "gym_registration" });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

paymentRouter.post("/gym/monthly/order", requireAuth, requireNotGuest, async (req, res) => {
  const { gymId } = req.body;
  if (!gymId) { res.status(400).json({ error: "gymId is required" }); return; }

  try {
    const gym = (
      await db
        .select({ id: gymProfiles.id, ownerUserId: gymProfiles.ownerUserId })
        .from(gymProfiles)
        .where(eq(gymProfiles.id, gymId))
        .limit(1)
    )[0];
    if (!gym) { res.status(404).json({ error: "Gym not found" }); return; }
    if (gym.ownerUserId !== (req as any).user.id) {
      res.status(403).json({ error: "You do not have access to this gym." });
      return;
    }

    const amount = PRICES.gym_monthly;
    const order = await createOrder(amount, "gym_monthly", { gymId });
    await saveOrder(order.id, amount, "gym_monthly", (req as any).user.id, gymId);
    res.json({ order, amount, purpose: "gym_monthly" });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

paymentRouter.post("/pro/order", async (req, res) => {
  const { fighterId } = req.body;
  if (!fighterId) { res.status(400).json({ error: "fighterId is required" }); return; }

  try {
    const fighter = (
      await db.select({ id: users.id, isGuest: users.isGuest }).from(users).where(eq(users.id, fighterId)).limit(1)
    )[0];
    if (!fighter) { res.status(404).json({ error: "Fighter not found" }); return; }
    if (fighter.isGuest) {
      res.status(403).json({ error: "Guest accounts can only browse FightFind. Create an account to continue." });
      return;
    }

    const amount = PRICES.fighter_pro;
    const order = await createOrder(amount, "fighter_pro", { fighterId });
    await saveOrder(order.id, amount, "fighter_pro", fighterId, null, fighterId);
    res.json({ order, amount, purpose: "fighter_pro" });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

paymentRouter.post("/verify", async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId) { res.status(400).json({ error: "orderId is required" }); return; }

  try {
    const payment = (
      await db.select().from(payments).where(eq(payments.providerOrderId, orderId)).limit(1)
    )[0];
    if (!payment) { res.status(404).json({ error: "Order not found" }); return; }

    if (payment.status === "paid") {
      res.json({ success: true, purpose: payment.type, alreadyPaid: true });
      return;
    }

    const ok = verifySignature(orderId, paymentId ?? "", signature ?? "");
    if (!ok) { res.status(400).json({ error: "Payment signature verification failed" }); return; }

    const paymentIdFinal = paymentId ?? `pay_mock_${crypto.randomUUID()}`;

    await db
      .update(payments)
      .set({ status: "paid", providerPaymentId: paymentIdFinal, updatedAt: new Date().toISOString() })
      .where(eq(payments.id, payment.id));

    if (payment.type === "gym_monthly" && payment.gymId) {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const existing = (
        await db
          .select()
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.gymId, payment.gymId),
              eq(subscriptions.type, "gym_monthly")
            )
          )
          .orderBy(desc(subscriptions.createdAt))
          .limit(1)
      )[0];

      if (existing) {
        await db
          .update(subscriptions)
          .set({
            status: "active",
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: end.toISOString(),
            updatedAt: now.toISOString(),
          })
          .where(eq(subscriptions.id, existing.id));
      } else {
        await db.insert(subscriptions).values({
          userId: payment.userId,
          gymId: payment.gymId,
          type: "gym_monthly",
          status: "active",
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: end.toISOString(),
        });
      }
    }

    res.json({ success: true, purpose: payment.type });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
