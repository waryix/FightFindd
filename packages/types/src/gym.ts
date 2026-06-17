export type GymDiscipline = "boxing" | "mma" | "kickboxing" | "muay_thai" | "bjj" | "wrestling" | "mixed";

export interface GymLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
}

export interface Gym {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email?: string;
  location: GymLocation;
  disciplines: GymDiscipline[];
  monthlyFeeInr?: number;
  hasTrialClass: boolean;
  timings: string;
  description?: string;
  photoUrls: string[];
  isVerified: boolean;
  createdAt: string;
}
