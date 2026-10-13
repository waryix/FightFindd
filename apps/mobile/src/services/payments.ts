import { API_URL } from "./config";

const PRO_PRICE = 100;

export async function upgradeToPro(fighterId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const orderRes = await fetch(`${API_URL}/api/payments/pro/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fighterId }),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) return { success: false, error: orderData.error ?? "Could not start payment" };

    const order = orderData.order;
    if (!order?.mock) {
      return { success: false, error: "In-app checkout not configured for live keys." };
    }

    const verifyRes = await fetch(`${API_URL}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        paymentId: `pay_mock_${Date.now()}`,
        signature: "mock_signature",
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) return { success: false, error: verifyData.error ?? "Payment verification failed" };

    return { success: true };
  } catch {
    return { success: false, error: "Could not connect to server" };
  }
}

export { PRO_PRICE };
