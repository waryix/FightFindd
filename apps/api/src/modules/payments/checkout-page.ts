const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface CheckoutPageParams {
  keyId: string;
  orderId?: string;
  subscriptionId?: string;
  amountPaise: number;
  currency: string;
  title: string;
  description: string;
  callbackUrl: string;
  testMode: boolean;
}

/**
 * Minimal hosted Razorpay Checkout page. Rendered inside the mobile WebView
 * (and usable from any browser). On completion it redirects to a deep link
 * carrying the Razorpay identifiers so the client can verify server-side.
 */
export function renderCheckoutPage(params: CheckoutPageParams): string {
  const amountInr = (params.amountPaise / 100).toFixed(2);
  const options = {
    key: params.keyId,
    name: "FightFind",
    description: params.description,
    ...(params.orderId ? { order_id: params.orderId } : {}),
    ...(params.subscriptionId ? { subscription_id: params.subscriptionId, recurring: 1 } : {}),
    ...(params.orderId ? { amount: params.amountPaise, currency: params.currency } : {}),
    theme: { color: "#E63946" },
    handler: undefined,
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>FightFind Payment</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0A0A0A; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; text-align: center; }
  .logo { width: 64px; height: 64px; border-radius: 16px; background: #E63946; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 24px; }
  h1 { font-size: 20px; margin: 0; }
  .amount { font-size: 34px; font-weight: 800; }
  .muted { color: #888; font-size: 13px; line-height: 1.5; }
  .pill { border: 1px solid #2A2A2A; background: #141414; padding: 6px 12px; border-radius: 999px; font-size: 12px; color: #f59e0b; }
  button { background: #E63946; color: #fff; border: 0; border-radius: 12px; padding: 16px 24px; font-size: 16px; font-weight: 700; width: 100%; max-width: 320px; }
  #fallback { display: none; flex-direction: column; gap: 12px; align-items: center; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="logo">FF</div>
    <h1>${escapeHtml(params.title)}</h1>
    <div class="amount">₹${escapeHtml(amountInr)}</div>
    <p class="muted">${escapeHtml(params.description)}</p>
    ${params.testMode ? '<span class="pill">TEST MODE — no real money moves</span>' : ""}
    <div id="fallback">
      <p class="muted" id="fallbackMessage">Preparing secure checkout…</p>
    </div>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    (function () {
      var callback = ${JSON.stringify(params.callbackUrl)};
      var options = ${JSON.stringify(options)};
      options.handler = function (response) {
        var separator = callback.indexOf("?") >= 0 ? "&" : "?";
        var url = callback + separator +
          "status=success" +
          "&razorpay_payment_id=" + encodeURIComponent(response.razorpay_payment_id || "") +
          "&razorpay_order_id=" + encodeURIComponent(response.razorpay_order_id || "") +
          "&razorpay_subscription_id=" + encodeURIComponent(response.razorpay_subscription_id || "") +
          "&razorpay_signature=" + encodeURIComponent(response.razorpay_signature || "");
        window.location.href = url;
      };
      options.modal = {
        ondismiss: function () {
          window.location.href = callback + (callback.indexOf("?") >= 0 ? "&" : "?") + "status=dismissed";
        },
      };
      if (typeof Razorpay === "undefined") {
        document.getElementById("fallback").style.display = "flex";
        document.getElementById("fallbackMessage").textContent =
          "Could not load Razorpay Checkout. Check your connection and reopen this screen.";
        return;
      }
      try {
        new Razorpay(options).open();
      } catch (error) {
        document.getElementById("fallback").style.display = "flex";
        document.getElementById("fallbackMessage").textContent = "Checkout failed to open. Please retry.";
      }
    })();
  </script>
</body>
</html>`;
}
