import { describe, expect, it } from "vitest";
import {
  activityScore,
  compatibilityScore,
  disciplineCompatibility,
  skillCompatibility,
  weightCompatibility,
} from "./matching.js";

describe("weightCompatibility", () => {
  it("scores same class 1", () => {
    expect(weightCompatibility("welterweight", "welterweight")).toBe(1);
  });
  it("penalizes adjacent classes", () => {
    expect(weightCompatibility("welterweight", "middleweight")).toBe(0.6);
  });
  it("penalizes distant classes", () => {
    expect(weightCompatibility("flyweight", "heavyweight")).toBe(0.15);
  });
  it("is neutral when unknown", () => {
    expect(weightCompatibility(null, "heavyweight")).toBe(0.5);
  });
});

describe("skillCompatibility", () => {
  it("scores equal skills 1", () => {
    expect(skillCompatibility("advanced", "advanced")).toBe(1);
  });
  it("scores one-step gap 0.7", () => {
    expect(skillCompatibility("beginner", "intermediate")).toBe(0.7);
  });
  it("scores opposite skills 0", () => {
    expect(skillCompatibility("beginner", "professional")).toBe(0);
  });
});

describe("disciplineCompatibility", () => {
  it("scores full overlap 1", () => {
    expect(disciplineCompatibility(["boxing", "mma"], ["boxing", "mma"])).toBe(1);
  });
  it("scores partial overlap", () => {
    expect(disciplineCompatibility(["boxing", "mma"], ["boxing"])).toBe(0.5);
  });
  it("gives mixed a wildcard bonus", () => {
    expect(disciplineCompatibility(["mixed"], ["bjj"])).toBe(0.5);
  });
  it("scores no overlap 0", () => {
    expect(disciplineCompatibility(["boxing"], ["bjj"])).toBe(0);
  });
});

describe("activityScore", () => {
  const now = new Date("2026-10-07T00:00:00Z");
  it("rewards recent activity", () => {
    expect(activityScore("2026-10-06T00:00:00Z", now)).toBe(1);
  });
  it("decays for stale profiles", () => {
    expect(activityScore("2026-06-01T00:00:00Z", now)).toBe(0.2);
  });
  it("is neutral when unknown", () => {
    expect(activityScore(null, now)).toBe(0.3);
  });
});

describe("compatibilityScore", () => {
  const viewer = {
    weightClass: "welterweight" as const,
    skillLevel: "advanced" as const,
    disciplines: ["boxing", "mma"] as const,
    lastActiveAt: "2026-10-06T00:00:00Z",
  };
  const now = new Date("2026-10-07T00:00:00Z");

  it("gives identical nearby fighters a top score", () => {
    const result = compatibilityScore(
      { ...viewer, disciplines: [...viewer.disciplines] },
      { ...viewer, disciplines: [...viewer.disciplines] },
      1,
      50,
      now,
    );
    expect(result.score).toBe(100);
    expect(result.label).toBe("Great Match");
  });

  it("penalizes mismatched weight and skill", () => {
    const result = compatibilityScore(
      { ...viewer, disciplines: [...viewer.disciplines] },
      {
        weightClass: "heavyweight",
        skillLevel: "beginner",
        disciplines: ["wrestling"],
        lastActiveAt: "2026-01-01T00:00:00Z",
      },
      40,
      50,
      now,
    );
    expect(result.score).toBeLessThan(40);
    expect(result.label).toBe("Fair Match");
  });

  it("stays within 0-100 and includes breakdown", () => {
    const result = compatibilityScore(
      { ...viewer, disciplines: [...viewer.disciplines] },
      { ...viewer, disciplines: [...viewer.disciplines] },
      null,
      50,
      now,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.activity).toBe(1);
  });
});
