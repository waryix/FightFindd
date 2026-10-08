import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RazorpayPaymentProvider } from "../../src/modules/payments/razorpay.client.js";

const provider = new RazorpayPaymentProvider({
  keyId: "rzp_test_key",
  keySecret: "test_secret",
  webhookSecret: "whsec_test",
  mode: "test",
});

describe("RazorpayPaymentProvider signature verification", () => {
  it("accepts a valid checkout payment signature", () => {
    const orderId = "order_123";
    const paymentId = "pay_456";
    const signature = createHmac("sha256", "test_secret").update(`${orderId}|${paymentId}`).digest("hex");
    expect(provider.verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it("rejects an invalid checkout signature", () => {
    expect(
      provider.verifyPaymentSignature({ orderId: "order_123", paymentId: "pay_456", signature: "deadbeef" }),
    ).toBe(false);
  });

  it("accepts a valid webhook signature over the raw body", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = createHmac("sha256", "whsec_test").update(rawBody).digest("hex");
    expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects a webhook signature over a modified body", () => {
    const signature = createHmac("sha256", "whsec_test")
      .update(JSON.stringify({ event: "payment.captured" }))
      .digest("hex");
    const tampered = JSON.stringify({ event: "payment.captured", amount: 1 });
    expect(provider.verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects everything when no webhook secret is configured", () => {
    const bare = new RazorpayPaymentProvider({
      keyId: "k",
      keySecret: "s",
      webhookSecret: "",
      mode: "test",
    });
    expect(bare.verifyWebhookSignature("{}", "anything")).toBe(false);
  });
});
