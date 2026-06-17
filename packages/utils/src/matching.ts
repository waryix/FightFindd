import type { Fighter } from "@repo/types/fighter";

const SKILL_RANK: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  professional: 4,
};

export function skillGap(a: Fighter, b: Fighter): number {
  return Math.abs(SKILL_RANK[a.skillLevel] - SKILL_RANK[b.skillLevel]);
}

export function areCompatible(a: Fighter, b: Fighter): boolean {
  const sharedDiscipline = a.discipline.some(d => b.discipline.includes(d));
  const sameWeightClass = a.weightClass === b.weightClass;
  const acceptableSkillGap = skillGap(a, b) <= 1;
  return sharedDiscipline && sameWeightClass && acceptableSkillGap;
}

export function compatibilityScore(a: Fighter, b: Fighter): number {
  let score = 0;
  if (a.weightClass === b.weightClass) score += 40;
  if (skillGap(a, b) === 0) score += 30;
  else if (skillGap(a, b) === 1) score += 15;
  const sharedCount = a.discipline.filter(d => b.discipline.includes(d)).length;
  score += sharedCount * 10;
  return Math.min(score, 100);
}
