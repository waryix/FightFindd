import { describe, expect, it } from "vitest";
import { boundingBox, distanceKm, distanceScore, formatDistance } from "./geo.js";

describe("distanceKm", () => {
  it("returns 0 for identical points", () => {
    expect(distanceKm(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
  });

  it("computes Bengaluru to Mumbai (~840 km)", () => {
    const d = distanceKm(12.9716, 77.5946, 19.076, 72.8777);
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(880);
  });

  it("computes a short intra-city distance", () => {
    const d = distanceKm(12.9716, 77.5946, 12.9352, 77.6245); // ~4.6 km Koramangala
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(6);
  });

  it("is symmetric", () => {
    const a = distanceKm(12.9, 77.5, 13.1, 77.7);
    const b = distanceKm(13.1, 77.7, 12.9, 77.5);
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });
});

describe("boundingBox", () => {
  it("contains the circle extremes", () => {
    const box = boundingBox(12.9716, 77.5946, 25);
    expect(box.minLat).toBeLessThan(12.9716);
    expect(box.maxLat).toBeGreaterThan(12.9716);
    expect(box.minLon).toBeLessThan(77.5946);
    expect(box.maxLon).toBeGreaterThan(77.5946);
    // Bounding box around 25km must include a point ~24km due north.
    const north = 12.9716 + 24 / 111.32;
    expect(north).toBeLessThanOrEqual(box.maxLat);
  });
});

describe("distanceScore", () => {
  it("returns 1 at zero distance", () => {
    expect(distanceScore(0)).toBe(1);
  });
  it("returns 0.5 when distance unknown", () => {
    expect(distanceScore(null)).toBe(0.5);
  });
  it("decays with distance and never goes below 0", () => {
    expect(distanceScore(25, 50)).toBeCloseTo(0.5, 5);
    expect(distanceScore(500, 50)).toBe(0);
  });
});

describe("formatDistance", () => {
  it("formats sub-kilometre distances in metres", () => {
    expect(formatDistance(0.8)).toBe("800 m");
  });
  it("formats kilometres", () => {
    expect(formatDistance(2.44)).toBe("2.4 km");
    expect(formatDistance(24.6)).toBe("25 km");
  });
});
