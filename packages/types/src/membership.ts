import {
  membershipStatusSchema,
  type MembershipStatus,
  type MembershipRequestStatus,
} from "./constants.js";
import type { FighterSummary } from "./matching.js";
import { z } from "zod";

export interface GymMembershipSummary {
  id: string;
  gymId: string;
  gymName: string;
  gymCity: string;
  fighterUserId: string;
  amountPaise: number;
  currency: string;
  status: MembershipStatus;
  startedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GymMembershipWithFighter extends GymMembershipSummary {
  fighter: FighterSummary | null;
  requestStatus: MembershipRequestStatus | null;
  requestDate: string | null;
}

export interface FighterMembershipView {
  id: string;
  gym: {
    id: string;
    name: string;
    city: string;
    coverPhotoUrl: string | null;
  };
  status: MembershipStatus;
  requestStatus: MembershipRequestStatus | null;
  amountPaise: number;
  startedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const membershipQuerySchema = z.object({
  status: membershipStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MembershipQuery = z.infer<typeof membershipQuerySchema>;
