import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { messages } from "../../db/schema.js";
import { conflict, notFound } from "../../lib/errors.js";
import { buildPage, decodeCursor, type Page } from "../../lib/cursor.js";
import type { ChatMessage } from "@fightfind/types";
import type { NotificationService } from "../notifications/notifications.service.js";
import type { SparringService } from "../sparring/sparring.service.js";

export class MessagesService {
  constructor(
    private readonly db: Db,
    private readonly sparring: SparringService,
    private readonly notifications: NotificationService,
  ) {}

  mapMessage(row: typeof messages.$inferSelect): ChatMessage {
    return {
      id: row.id,
      matchId: row.matchId,
      senderId: row.senderId,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    };
  }

  private async assertParticipant(matchId: string, userId: string) {
    const match = await this.sparring.getRaw(matchId);
    if (!match || (match.senderId !== userId && match.receiverId !== userId)) {
      throw notFound("MATCH_NOT_FOUND", "Match not found");
    }
    return match;
  }

  /** Newest-first history with cursor pagination. Clients reverse for display. */
  async history(
    matchId: string,
    userId: string,
    params: { cursor?: string; limit: number },
  ): Promise<Page<ChatMessage>> {
    await this.assertParticipant(matchId, userId);
    const cursor = decodeCursor(params.cursor);
    const conditions = [eq(messages.matchId, matchId)];
    if (cursor) conditions.push(sql`${messages.createdAt} < ${cursor.createdAt}`);

    const rows = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(params.limit + 1);

    const page = buildPage(rows, params.limit);
    return { items: page.items.map((row) => this.mapMessage(row)), nextCursor: page.nextCursor };
  }

  async send(matchId: string, senderUserId: string, content: string): Promise<ChatMessage> {
    const match = await this.assertParticipant(matchId, senderUserId);
    if (match.status !== "accepted" && match.status !== "completed") {
      throw conflict("MATCH_NOT_ACCEPTED", "You can chat once the sparring request is accepted.");
    }

    const trimmed = content.trim();
    if (!trimmed) throw conflict("MESSAGE_EMPTY", "Message cannot be empty.");
    if (trimmed.length > 2000) throw conflict("MESSAGE_TOO_LONG", "Message is too long.");

    const [created] = await this.db
      .insert(messages)
      .values({ matchId, senderId: senderUserId, content: trimmed })
      .returning();
    if (!created) throw new Error("Failed to create message");

    const otherUserId = match.senderId === senderUserId ? match.receiverId : match.senderId;
    await this.notifications.notify({
      userId: otherUserId,
      type: "NEW_MESSAGE",
      title: "New message",
      body: trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed,
      data: { matchId },
    });

    return this.mapMessage(created);
  }

  async markRead(matchId: string, userId: string): Promise<number> {
    await this.assertParticipant(matchId, userId);
    const rows = await this.db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.matchId, matchId), ne(messages.senderId, userId), sql`${messages.readAt} is null`))
      .returning({ id: messages.id });
    return rows.length;
  }

  async unreadCount(matchId: string, userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.matchId, matchId), ne(messages.senderId, userId), sql`${messages.readAt} is null`));
    return row?.count ?? 0;
  }
}
