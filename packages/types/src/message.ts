import { z } from "zod";

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const messageHistoryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;

/** WebSocket client -> server frames. */
export type WsClientFrame =
  | { type: "ping" }
  | { type: "send_message"; matchId: string; content: string; clientId?: string }
  | { type: "read_messages"; matchId: string };

/** WebSocket server -> client frames. */
export type WsServerFrame =
  | { type: "pong" }
  | { type: "ready" }
  | { type: "message"; message: ChatMessage; clientId?: string }
  | { type: "error"; code: string; message: string; clientId?: string }
  | { type: "read"; matchId: string; readerId: string; at: string };
