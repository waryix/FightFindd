import { API_URL } from "./config";
import { getToken } from "../store/session";
import { checkout } from "./razorpay";
import type { OrderInfo } from "./razorpay";

export const MEMBERSHIP_PRICE = 99;

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export async function subscribeToMembership(): Promise<{ success: boolean; error?: string }> {
  try {
    const { order } = await authedPost<{ order: OrderInfo }>(
      "/api/payments/fighter/subscription/order",
      {}
    );
    const payment = await checkout(order, `FightFind membership (₹${MEMBERSHIP_PRICE}/month)`);

    const verifyRes = await fetch(`${API_URL}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        paymentId: payment.paymentId,
        signature: payment.signature,
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      return { success: false, error: verifyData.error ?? "Payment verification failed" };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Payment failed" };
  }
}
