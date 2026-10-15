import { Platform } from "react-native";
import { API_URL } from "./config";
import { gymAuthHeaders } from "./gymAuth";

export interface OrderInfo {
  id: string;
  amount: number;
  currency: string;
  status: string;
  mock: boolean;
  keyId: string;
}

export interface PaymentResult {
  paymentId: string;
  signature: string;
}

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

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    const doc = (globalThis as any).document;
    if (!doc) return resolve(false);
    if ((globalThis as any).Razorpay) return resolve(true);
    const script = doc.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    doc.body.appendChild(script);
  });
}

/**
 * Runs checkout for an order. In mock mode (dummy keys) it simulates a payment
 * so the flow is testable. Live keys open the Razorpay widget on web; a native
 * Razorpay build would be required for in-app live checkout.
 */
export async function checkout(order: OrderInfo, description: string): Promise<PaymentResult> {
  if (order.mock) {
    await new Promise((r) => setTimeout(r, 600));
    return { paymentId: `pay_mock_${Date.now()}`, signature: "mock_signature" };
  }

  if (Platform.OS !== "web") {
    throw new Error("Live checkout isn't available in this build. Start a mock payment or use a native Razorpay build.");
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error("Could not load Razorpay checkout");

  return new Promise<PaymentResult>((resolve, reject) => {
    const RazorpayCtor = (globalThis as any).Razorpay;
    const rzp = new RazorpayCtor({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "FightFind",
      description,
      order_id: order.id,
      handler: (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
        resolve({
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
      theme: { color: "#e63946" },
    });
    rzp.open();
  });
}
