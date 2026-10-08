import { loadEnv } from "../../env.js";
import { AppError } from "../../lib/errors.js";
import { MockPaymentProvider } from "./mock.provider.js";
import { RazorpayPaymentProvider } from "./razorpay.client.js";
import type { PaymentProvider } from "./payment.types.js";

export function createPaymentProvider(overrides?: { provider?: PaymentProvider }): PaymentProvider {
  if (overrides?.provider) return overrides.provider;
  const env = loadEnv();

  if (env.PAYMENT_MODE === "mock") {
    if (env.NODE_ENV === "production" && !env.PAYMENT_SIMULATOR_ENABLED) {
      throw new AppError(
        "PAYMENT_PROVIDER_ERROR",
        "PAYMENT_MODE=mock is not allowed in production. Configure real Razorpay credentials.",
        500,
      );
    }
    return new MockPaymentProvider();
  }

  // Developer convenience: test mode without credentials falls back to the
  // in-memory provider so the product stays fully usable locally. This never
  // happens in production (credentials are required by env validation there).
  if (env.NODE_ENV !== "production" && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)) {
    console.warn(
      "[payments] RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not set — using the in-memory mock provider for development.",
    );
    return new MockPaymentProvider();
  }

  return RazorpayPaymentProvider.fromEnv();
}
