"use client";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}

let scriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Opens Razorpay Checkout in the browser. Results are verified server-side by
 * the calling page before any business state changes.
 */
export async function openRazorpayCheckout(params: {
  keyId: string;
  orderId?: string;
  subscriptionId?: string;
  amountPaise?: number;
  currency?: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<RazorpayCheckoutResult | null> {
  const loaded = await loadRazorpayScript();
  const RazorpayCtor = typeof window !== "undefined" ? window.Razorpay : undefined;
  if (!loaded || !RazorpayCtor) {
    throw new Error("Could not load Razorpay Checkout. Check your connection.");
  }

  return new Promise((resolve) => {
    const options: Record<string, unknown> = {
      key: params.keyId,
      name: "FightFind",
      description: params.description,
      theme: { color: "#E63946" },
      prefill: params.prefill,
      handler: (response: RazorpayCheckoutResult) => resolve(response),
      modal: { ondismiss: () => resolve(null) },
    };
    if (params.orderId) options.order_id = params.orderId;
    if (params.subscriptionId) {
      options.subscription_id = params.subscriptionId;
      options.recurring = 1;
    }
    if (params.amountPaise) options.amount = params.amountPaise;
    if (params.currency) options.currency = params.currency;
    const checkout = new RazorpayCtor(options);
    checkout.open();
  });
}
