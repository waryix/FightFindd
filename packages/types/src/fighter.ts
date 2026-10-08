import { z } from "zod";
import {
  disciplineSchema,
  skillLevelSchema,
  weightClassSchema,
  type Discipline,
  type SkillLevel,
  type WeightClass,
  DISCOVERY_SORT_OPTIONS,
} from "./constants.js";

export const profileFieldsSchema = z.object({
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(120),
  ageYears: z.number().int().min(14).max(90).nullable().optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  weightKg: z.number().min(30).max(300).nullable().optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  totalAmateurFights: z.number().int().min(0).max(2000).optional(),
  totalProFights: z.number().int().min(0).max(2000).optional(),
  bio: z.string().max(1000).nullable().optional(),
  disciplines: z.array(disciplineSchema).min(1).max(7),
  skillLevel: skillLevelSchema,
  weightClass: weightClassSchema,
  gymId: z.string().uuid().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const createFighterProfileSchema = profileFieldsSchema;
export type CreateFighterProfileInput = z.infer<typeof createFighterProfileSchema>;

export const updateFighterProfileSchema = profileFieldsSchema.partial();
export type UpdateFighterProfileInput = z.infer<typeof updateFighterProfileSchema>;

export interface FighterProfile {
  id: string;
  userId: string;
  name: string;
  city: string;
  state: string;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  yearsExperience: number;
  totalAmateurFights: number;
  totalProFights: number;
  bio: string | null;
  disciplines: Discipline[];
  skillLevel: SkillLevel;
  weightClass: WeightClass;
  gymId: string | null;
  gymName: string | null;
  avatarUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  premiumStatus: boolean;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FighterCard extends FighterProfile {
  distanceKm: number | null;
  compatibilityScore: number | null;
  matchLabel: string | null;
}

export const discoveryQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional(),
  city: z.string().max(120).optional(),
  discipline: disciplineSchema.optional(),
  skill: skillLevelSchema.optional(),
  weightClass: weightClassSchema.optional(),
  minHeight: z.coerce.number().min(100).max(250).optional(),
  maxHeight: z.coerce.number().min(100).max(250).optional(),
  minWeight: z.coerce.number().min(30).max(300).optional(),
  maxWeight: z.coerce.number().min(30).max(300).optional(),
  minExperience: z.coerce.number().min(0).max(60).optional(),
  maxExperience: z.coerce.number().min(0).max(60).optional(),
  minFights: z.coerce.number().min(0).optional(),
  maxFights: z.coerce.number().min(0).optional(),
  search: z.string().max(120).optional(),
  sort: z.enum(DISCOVERY_SORT_OPTIONS).default("best_match"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;

export const compatibilityWeights = {
  weight: 0.3,
  skill: 0.25,
  discipline: 0.2,
  distance: 0.2,
  activity: 0.05,
};

export interface CompatibilityBreakdown {
  score: number;
  label: "Great Match" | "Good Match" | "Fair Match";
  weight: number;
  skill: number;
  discipline: number;
  distance: number;
  activity: number;
}
