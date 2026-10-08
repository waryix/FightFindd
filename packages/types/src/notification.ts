import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "SPARRING_REQUEST_RECEIVED",
  "SPARRING_REQUEST_ACCEPTED",
  "SPARRING_REQUEST_DECLINED",
  "NEW_MESSAGE",
  "MEMBERSHIP_REQUEST_RECEIVED",
  "MEMBERSHIP_APPROVED",
  "MEMBERSHIP_REJECTED",
  "PAYMENT_SUCCESSFUL",
  "PAYMENT_FAILED",
  "PREMIUM_RENEWED",
  "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_FAILED",
  "LISTING_VERIFIED",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListQuery {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

export const registerDeviceSchema = z.object({
  token: z.string().min(8).max(500),
  platform: z.enum(["ios", "android", "web"]),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
