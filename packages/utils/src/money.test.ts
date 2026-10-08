import { describe, expect, it } from "vitest";
import {
  assertPositiveAmount,
  formatPaise,
  fromProviderAmount,
  paiseToRupees,
  rupeesToPaise,
  splitPayment,
  toProviderAmount,
} from "./money.js";

describe("rupeesToPaise", () => {
  it("converts whole rupees", () => {
    expect(rupeesToPaise(999)).toBe(99900);
  });
  it("converts decimals without float drift", () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(0.1)).toBe(10);
  });
  it("round-trips", () => {
    expect(paiseToRupees(99900)).toBe(999);
  });
});

describe("assertPositiveAmount", () => {
  it("rejects zero, negatives, and non-integers", () => {
    expect(() => assertPositiveAmount(0)).toThrow();
    expect(() => assertPositiveAmount(-100)).toThrow();
    expect(() => assertPositiveAmount(99.5)).toThrow();
  });
  it("accepts positive integer paise", () => {
    expect(() => assertPositiveAmount(99900)).not.toThrow();
  });
});

describe("splitPayment", () => {
  it("gives the full amount to the merchant at 0% commission", () => {
    expect(splitPayment(500000, 0)).toEqual({ platformPaise: 0, merchantPaise: 500000 });
  });
  it("splits at 5% commission with integer paise", () => {
    const { platformPaise, merchantPaise } = splitPayment(500000, 5);
    expect(platformPaise).toBe(25000);
    expect(merchantPaise).toBe(475000);
    expect(platformPaise + merchantPaise).toBe(500000);
  });
  it("never loses or creates paise for awkward amounts", () => {
    for (const amount of [1, 7, 99, 101, 12345, 999989]) {
      const { platformPaise, merchantPaise } = splitPayment(amount, 2.75);
      expect(platformPaise + merchantPaise).toBe(amount);
      expect(Number.isInteger(platformPaise)).toBe(true);
      expect(Number.isInteger(merchantPaise)).toBe(true);
    }
  });
});

describe("provider amount helpers", () => {
  it("passes paise through unchanged", () => {
    expect(toProviderAmount(99900)).toBe(99900);
  });
  it("parses provider amounts from strings", () => {
    expect(fromProviderAmount("99900")).toBe(99900);
  });
  it("rejects malformed provider amounts", () => {
    expect(() => fromProviderAmount("abc")).toThrow();
    expect(() => fromProviderAmount(-5)).toThrow();
  });
});

describe("formatPaise", () => {
  it("formats INR", () => {
    expect(formatPaise(99900)).toContain("999");
    expect(formatPaise(19900)).toContain("199");
  });
});
