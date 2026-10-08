import { describe, expect, it } from "vitest";
import { normalizeIdentifier } from "../../src/modules/auth/otp.service.js";
import { generateRefreshToken, hashOtpCode, hashToken } from "../../src/modules/auth/tokens.js";

describe("normalizeIdentifier", () => {
  it("normalizes 10-digit Indian numbers", () => {
    expect(normalizeIdentifier("phone", "9876543210")).toBe("+919876543210");
  });
  it("normalizes +91 numbers", () => {
    expect(normalizeIdentifier("phone", "+919876543210")).toBe("+919876543210");
  });
  it("normalizes numbers with spaces/dashes and country code", () => {
    expect(normalizeIdentifier("phone", "+91 98765-43210")).toBe("+919876543210");
  });
  it("lowercases and trims emails", () => {
    expect(normalizeIdentifier("email", "  Arjun@FightFind.TEST ")).toBe("arjun@fightfind.test");
  });
});

describe("tokens", () => {
  it("generates high-entropy refresh tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(40);
  });
  it("hashes tokens deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
  it("hashes OTPs deterministically and salted", () => {
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
    expect(hashOtpCode("123456")).not.toBe(hashOtpCode("654321"));
    expect(hashOtpCode("123456")).not.toContain("123456");
  });
});
