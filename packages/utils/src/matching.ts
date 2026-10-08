import {
  MATCH_SCORE_WEIGHTS,
  WEIGHT_CLASSES,
  type Discipline,
  type SkillLevel,
  type WeightClass,
} from "@fightfind/types";
import { distanceScore } from "./geo.js";

const SKILL_RANK: Record<SkillLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  professional: 4,
};

export interface MatchProfile {
  weightClass: WeightClass | null;
  weightKg?: number | null;
  skillLevel: SkillLevel | null;
  disciplines: Discipline[];
  lastActiveAt?: string | Date | null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** 1 for same class, decaying for neighbours, 0.15 floor for far classes. */
export function weightCompatibility(a: WeightClass | null, b: WeightClass | null): number {
  if (!a || !b) return 0.5;
  const ia = WEIGHT_CLASSES.indexOf(a);
  const ib = WEIGHT_CLASSES.indexOf(b);
  if (ia < 0 || ib < 0) return 0.5;
  const gap = Math.abs(ia - ib);
  if (gap === 0) return 1;
  if (gap === 1) return 0.6;
  if (gap === 2) return 0.3;
  return 0.15;
}

export function skillCompatibility(a: SkillLevel | null, b: SkillLevel | null): number {
  if (!a || !b) return 0.5;
  const gap = Math.abs(SKILL_RANK[a] - SKILL_RANK[b]);
  if (gap === 0) return 1;
  if (gap === 1) return 0.7;
  if (gap === 2) return 0.3;
  return 0;
}

export function disciplineCompatibility(a: Discipline[], b: Discipline[]): number {
  if (a.length === 0 || b.length === 0) return 0.3;
  const setB = new Set(b);
  const shared = a.filter((d) => setB.has(d)).length;
  if (shared === 0) {
    // "mixed" acts as a wildcard discipline.
    if (a.includes("mixed") || b.includes("mixed")) return 0.5;
    return 0;
  }
  return clamp01(shared / Math.max(a.length, b.length));
}

export function activityScore(lastActiveAt?: string | Date | null, now: Date = new Date()): number {
  if (!lastActiveAt) return 0.3;
  const then = lastActiveAt instanceof Date ? lastActiveAt : new Date(lastActiveAt);
  if (Number.isNaN(then.getTime())) return 0.3;
  const days = (now.getTime() - then.getTime()) / 86_400_000;
  if (days <= 3) return 1;
  if (days <= 14) return 0.7;
  if (days <= 45) return 0.4;
  return 0.2;
}

export interface CompatibilityResult {
  score: number;
  label: "Great Match" | "Good Match" | "Fair Match";
  breakdown: {
    weight: number;
    skill: number;
    discipline: number;
    distance: number;
    activity: number;
  };
}

/**
 * Weighted compatibility score (0-100). Ranking mechanism only — not a
 * guarantee of sparring safety.
 */
export function compatibilityScore(
  viewer: MatchProfile,
  candidate: MatchProfile,
  distance: number | null,
  maxReferenceKm = 50,
  now: Date = new Date(),
): CompatibilityResult {
  const breakdown = {
    weight: weightCompatibility(viewer.weightClass, candidate.weightClass),
    skill: skillCompatibility(viewer.skillLevel, candidate.skillLevel),
    discipline: disciplineCompatibility(viewer.disciplines, candidate.disciplines),
    distance: distanceScore(distance, maxReferenceKm),
    activity: activityScore(candidate.lastActiveAt, now),
  };

  const score = Math.round(
    (breakdown.weight * MATCH_SCORE_WEIGHTS.weight +
      breakdown.skill * MATCH_SCORE_WEIGHTS.skill +
      breakdown.discipline * MATCH_SCORE_WEIGHTS.discipline +
      breakdown.distance * MATCH_SCORE_WEIGHTS.distance +
      breakdown.activity * MATCH_SCORE_WEIGHTS.activity) *
      100,
  );

  const label: CompatibilityResult["label"] =
    score >= 85 ? "Great Match" : score >= 70 ? "Good Match" : "Fair Match";

  return { score, label, breakdown };
}

export function areCompatible(a: MatchProfile, b: MatchProfile): boolean {
  const shared = disciplineCompatibility(a.disciplines, b.disciplines);
  return weightCompatibility(a.weightClass, b.weightClass) >= 0.3 && shared > 0;
}
