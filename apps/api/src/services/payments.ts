import { createHmac, randomUUID } from "node:crypto";

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

export const PAYMENTS_MOCK =
  process.env.PAYMENTS_MOCK === "true" ||
  !KEY_ID ||
  !KEY_SECRET ||
  KEY_ID.includes("dummy") ||
  KEY_SECRET.includes("dummy");

export const RAZORPAY_KEY_ID = KEY_ID;

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  mock: boolean;
  keyId: string;
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
}

export async function createOrder(
  amount: number,
  purpose: string,
  notes: Record<string, string> = {}
): Promise<RazorpayOrder> {
  if (PAYMENTS_MOCK) {
    return {
      id: `order_mock_${randomUUID()}`,
      amount,
      currency: "INR",
      status: "created",
      mock: true,
      keyId: KEY_ID || "rzp_test_dummy",
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: `${purpose}_${Date.now()}`,
      notes,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Razorpay order failed (${response.status}): ${detail}`);
  }

  const order = await response.json() as any;
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    mock: false,
    keyId: KEY_ID,
  };
}

export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (PAYMENTS_MOCK) return true;
  if (!orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}
