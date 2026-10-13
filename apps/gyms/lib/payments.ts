import { API_URL } from "./api";

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

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<void> {
  await post("/api/payments/verify", { orderId, paymentId, signature });
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Runs checkout for an order. In mock mode (dummy keys) it skips the real
 * Razorpay widget and returns a simulated payment id so the flow is testable.
 */
export async function checkout(order: OrderInfo, description: string): Promise<PaymentResult> {
  if (order.mock) {
    await new Promise((r) => setTimeout(r, 600));
    return { paymentId: `pay_mock_${Date.now()}`, signature: "mock_signature" };
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error("Could not load Razorpay checkout");

  return new Promise<PaymentResult>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "FightFind",
      description,
      order_id: order.id,
      handler: (response: RazorpayHandlerResponse) => {
        resolve({
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      theme: { color: "#e63946" },
    });
    rzp.open();
  });
}
