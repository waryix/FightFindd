import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../config/db";
import { createOrder, verifySignature, PAYMENTS_MOCK, RAZORPAY_KEY_ID } from "../services/payments";

export const paymentRouter: IRouter = Router();

const PRICES = {
  gym_registration: 100000, // ₹1000 one-time
  gym_monthly: 30000,       // ₹300 / month
  fighter_pro: 10000,       // ₹100 one-time
} as const;

type Purpose = keyof typeof PRICES;

function saveOrder(orderId: string, amount: number, purpose: Purpose, entityId: string | null) {
  db.prepare(`
    INSERT INTO payments (id, order_id, amount, currency, purpose, entity_id, status)
    VALUES (?, ?, ?, 'INR', ?, ?, 'created')
  `).run(randomUUID(), orderId, amount, purpose, entityId);
}

paymentRouter.get("/config", (_req, res) => {
  res.json({ mock: PAYMENTS_MOCK, keyId: RAZORPAY_KEY_ID || "rzp_test_dummy" });
});

paymentRouter.post("/gym/order", async (_req, res) => {
  try {
    const amount = PRICES.gym_registration;
    const order = await createOrder(amount, "gym_registration");
    saveOrder(order.id, amount, "gym_registration", null);
    res.json({ order, amount, purpose: "gym_registration" });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

paymentRouter.post("/gym/monthly/order", async (req, res) => {
  const { gymId } = req.body;
  if (!gymId) { res.status(400).json({ error: "gymId is required" }); return; }
  const gym = db.prepare("SELECT id FROM gyms WHERE id = ?").get(gymId);
  if (!gym) { res.status(404).json({ error: "Gym not found" }); return; }

  try {
    const amount = PRICES.gym_monthly;
    const order = await createOrder(amount, "gym_monthly", { gymId });
    saveOrder(order.id, amount, "gym_monthly", gymId);
    res.json({ order, amount, purpose: "gym_monthly" });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

paymentRouter.post("/pro/order", async (req, res) => {
  const { fighterId } = req.body;
  if (!fighterId) { res.status(400).json({ error: "fighterId is required" }); return; }
  const fighter = db.prepare("SELECT id FROM fighters WHERE id = ?").get(fighterId);
  if (!fighter) { res.status(404).json({ error: "Fighter not found" }); return; }

  try {
    const amount = PRICES.fighter_pro;
    const order = await createOrder(amount, "fighter_pro", { fighterId });
    saveOrder(order.id, amount, "fighter_pro", fighterId);
    res.json({ order, amount, purpose: "fighter_pro" });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

paymentRouter.post("/verify", (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId) { res.status(400).json({ error: "orderId is required" }); return; }

  const payment = db.prepare("SELECT * FROM payments WHERE order_id = ?").get(orderId) as any;
  if (!payment) { res.status(404).json({ error: "Order not found" }); return; }

  if (payment.status === "paid") {
    res.json({ success: true, purpose: payment.purpose, alreadyPaid: true });
    return;
  }

  const ok = verifySignature(orderId, paymentId ?? "", signature ?? "");
  if (!ok) { res.status(400).json({ error: "Payment signature verification failed" }); return; }

  const paymentIdFinal = paymentId ?? `pay_mock_${randomUUID()}`;

  db.prepare(`
    UPDATE payments SET status = 'paid', payment_id = ?, paid_at = datetime('now') WHERE order_id = ?
  `).run(paymentIdFinal, orderId);

  if (payment.purpose === "gym_monthly" && payment.entity_id) {
    db.prepare(`
      UPDATE gyms SET monthly_status = 'active', next_billing_at = datetime('now', '+30 days'), last_payment_id = ?
      WHERE id = ?
    `).run(paymentIdFinal, payment.entity_id);
  } else if (payment.purpose === "fighter_pro" && payment.entity_id) {
    db.prepare("UPDATE fighters SET is_pro = 1 WHERE id = ?").run(payment.entity_id);
  }

  res.json({ success: true, purpose: payment.purpose });
});
