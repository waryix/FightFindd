import { z } from "zod";
import {
  disciplineSchema,
  sparringRequestStatusSchema,
  type Discipline,
  type SparringRequestStatus,
} from "./constants.js";

export interface FighterSummary {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  city: string;
  state: string;
  skillLevel: string;
  weightClass: string;
  disciplines: Discipline[];
  yearsExperience: number;
  totalAmateurFights: number;
  totalProFights: number;
  isPremium: boolean;
  isVerified: boolean;
}

export interface SparringRequest {
  id: string;
  senderId: string;
  receiverId: string;
  sender: FighterSummary | null;
  receiver: FighterSummary | null;
  discipline: Discipline;
  proposedDate: string;
  proposedLocation: string;
  message: string | null;
  status: SparringRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export const createSparringRequestSchema = z.object({
  receiverId: z.string().uuid(),
  discipline: disciplineSchema,
  proposedDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  proposedLocation: z.string().min(2).max(300),
  message: z.string().max(1000).nullable().optional(),
});
export type CreateSparringRequestInput = z.infer<typeof createSparringRequestSchema>;

export const updateSparringRequestStatusSchema = z.object({
  status: sparringRequestStatusSchema,
});
export type UpdateSparringRequestStatusInput = z.infer<typeof updateSparringRequestStatusSchema>;

export interface MatchListQuery {
  tab: "received" | "sent";
  status?: SparringRequestStatus;
  cursor?: string;
  limit?: number;
}
