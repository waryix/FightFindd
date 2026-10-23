import { API_URL } from "./config";
import { gymAuthHeaders } from "./gymAuth";
import { checkout } from "./razorpay";
import type { OrderInfo } from "./razorpay";

export { checkout };
export type { OrderInfo };

async function post<T>(path: string, body: unknown, auth = true): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? await gymAuthHeaders() : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export function createGymOrder(): Promise<{ order: OrderInfo; amount: number }> {
  return post("/api/payments/gym/order", {});
}

export function createMonthlyOrder(gymId: string): Promise<{ order: OrderInfo; amount: number }> {
  return post("/api/payments/gym/monthly/order", { gymId });
}

export async function verifyPayment(orderId: string, paymentId: string, signature: string): Promise<void> {
  await post("/api/payments/verify", { orderId, paymentId, signature }, false);
}
