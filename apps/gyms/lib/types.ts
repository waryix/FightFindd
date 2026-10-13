export type GymDiscipline =
  | "boxing"
  | "mma"
  | "kickboxing"
  | "muay_thai"
  | "bjj"
  | "wrestling"
  | "mixed";

export interface Gym {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  disciplines: GymDiscipline[];
  monthly_fee_inr: number | null;
  has_trial_class: number;
  timings: string | null;
  description: string | null;
  photo_urls: string[];
  is_verified: number;
  registration_paid: number;
  monthly_status: string;
  next_billing_at: string | null;
  last_payment_id: string | null;
  created_at: string;
}

export const DISCIPLINES: GymDiscipline[] = [
  "boxing",
  "mma",
  "kickboxing",
  "muay_thai",
  "bjj",
  "wrestling",
  "mixed",
];

export const DISCIPLINE_COLOR: Record<string, string> = {
  boxing: "#3b82f6",
  mma: "#e63946",
  muay_thai: "#f59e0b",
  kickboxing: "#8b5cf6",
  bjj: "#22c55e",
  wrestling: "#f97316",
  mixed: "#06b6d4",
};

export function label(value: string): string {
  return value.replace("_", " ");
}
