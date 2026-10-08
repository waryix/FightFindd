/** Money is always integer paise. Never use floating point arithmetic on money. */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export function formatPaise(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

/**
 * Splits a payment between the platform and the merchant (gym) using integer
 * paise. Commission is a percentage with at most 2 decimals, e.g. 5 = 5%.
 * The platform part is rounded, the merchant receives the remainder so the
 * two always add up to the original amount.
 */
export function splitPayment(amountPaise: number, platformCommissionPercent: number) {
  assertPositiveAmount(amountPaise);
  const pct = Math.max(0, Math.min(100, platformCommissionPercent));
  const platformPaise = Math.round((amountPaise * Math.round(pct * 100)) / 10_000);
  const merchantPaise = amountPaise - platformPaise;
  return { platformPaise, merchantPaise };
}

export function assertPositiveAmount(amountPaise: number): void {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error(`Invalid payment amount (paise): ${amountPaise}`);
  }
}

/** Razorpay expects the smallest currency unit as an integer. */
export function toProviderAmount(amountPaise: number): number {
  assertPositiveAmount(amountPaise);
  return amountPaise;
}

export function fromProviderAmount(amountSmallestUnit: number | string): number {
  const n = typeof amountSmallestUnit === "string" ? Number.parseInt(amountSmallestUnit, 10) : amountSmallestUnit;
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid provider amount: ${amountSmallestUnit}`);
  return n;
}
