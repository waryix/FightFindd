export type Discipline = "boxing" | "mma" | "kickboxing" | "muay_thai" | "bjj" | "wrestling";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "professional";

export type WeightClass =
  | "flyweight"
  | "bantamweight"
  | "featherweight"
  | "lightweight"
  | "welterweight"
  | "middleweight"
  | "heavyweight";

export interface Fighter {
  id: string;
  name: string;
  phone: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  discipline: Discipline[];
  skillLevel: SkillLevel;
  weightClass: WeightClass;
  ageYears: number;
  yearsExperience: number;
  bio?: string;
  gymId?: string;
  avatarUrl?: string;
  isVerified: boolean;
  createdAt: string;
}
