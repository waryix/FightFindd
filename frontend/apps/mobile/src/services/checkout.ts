import { Linking, Platform } from "react-native";
import { API_URL } from "../config";

/**
 * Web checkout opens a popup synchronously (to survive the async order call)
 * and the hosted page redirects back to /payment-result. Native keeps the
 * in-app WebView + `fightfind://` deep link.
 */
export function beginCheckoutWindow(): Window | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

export function navigateCheckoutWindow(win: Window | null, url: string): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (win && !win.closed) {
      win.location.href = url;
    } else {
      window.open(url, "_blank");
    }
    return;
  }
  void Linking.openURL(url);
}

function returnUrl(): string | undefined {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/payment-result`;
  }
  return undefined;
}

export function buildPaymentCheckoutUrl(paymentId: string): string {
  const base = `${API_URL}/api/v1/payments/${paymentId}/checkout`;
  const ret = returnUrl();
  return ret ? `${base}?return=${encodeURIComponent(ret)}` : base;
}

export function buildSubscriptionCheckoutUrl(subscriptionId: string): string {
  const base = `${API_URL}/api/v1/subscriptions/${subscriptionId}/checkout`;
  const ret = returnUrl();
  return ret ? `${base}?return=${encodeURIComponent(ret)}` : base;
}

export const isWeb = Platform.OS === "web";
