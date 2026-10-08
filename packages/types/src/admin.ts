import { z } from "zod";
import { gymVerificationStatusSchema } from "./constants.js";

export type { AdminUserRecord } from "./auth.js";

export const adminListQuerySchema = z.object({
  q: z.string().max(120).optional(),
  status: z.string().max(60).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const adminVerifyGymSchema = z.object({
  status: gymVerificationStatusSchema,
  reason: z.string().max(500).optional(),
});
export type AdminVerifyGymInput = z.infer<typeof adminVerifyGymSchema>;

export interface AuditLogRecord {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const blockUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});
export type BlockUserInput = z.infer<typeof blockUserSchema>;

export const reportUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "fake_profile", "inappropriate_content", "other"]),
  details: z.string().max(1000).optional(),
});
export type ReportUserInput = z.infer<typeof reportUserSchema>;

export const analyticsEventSchema = z.object({
  name: z.string().min(2).max(120),
  properties: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().optional(),
});
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;

export const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(50),
});
export type AnalyticsBatchInput = z.infer<typeof analyticsBatchSchema>;
