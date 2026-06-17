import type { Discipline } from "./fighter";

export type MatchStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

export interface SparringRequest {
  id: string;
  senderId: string;
  receiverId: string;
  discipline: Discipline;
  proposedDate: string;
  proposedLocation: string;
  message?: string;
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MatchFilter {
  discipline?: Discipline;
  skillLevel?: string;
  weightClass?: string;
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
}
