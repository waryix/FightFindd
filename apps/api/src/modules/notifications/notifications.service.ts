import { and, eq, inArray, lt, desc, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { deviceTokens, notifications } from "../../db/schema.js";
import { loadEnv } from "../../env.js";
import { buildPage, decodeCursor, type Page } from "../../lib/cursor.js";
import type { AppNotification, NotificationType } from "@fightfind/types";

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Expo push delivery. Failures are swallowed — pushes are best-effort. */
export class PushSender {
  async send(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
    if (tokens.length === 0) return;
    const env = loadEnv();
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(
          tokens.map((token) => ({
            to: token,
            title,
            body,
            data: data ?? {},
            sound: "default",
          })),
        ),
      });
    } catch (error) {
      console.warn("[push] delivery failed (ignored):", error);
    }
  }
}

export class NotificationService {
  constructor(
    private readonly db: Db,
    private readonly push = new PushSender(),
  ) {}

  /** Creates an in-app notification and fires a best-effort push. Never throws. */
  async notify(input: NewNotification): Promise<void> {
    try {
      await this.db.insert(notifications).values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      });
      const tokens = await this.db
        .select({ token: deviceTokens.token })
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, input.userId));
      await this.push.send(
        tokens.map((t) => t.token),
        input.title,
        input.body,
        input.data,
      );
    } catch (error) {
      console.warn("[notifications] failed (ignored):", error);
    }
  }

  async list(
    userId: string,
    params: { cursor?: string; limit: number; unreadOnly?: boolean },
  ): Promise<Page<AppNotification>> {
    const cursor = decodeCursor(params.cursor);
    const conditions = [eq(notifications.userId, userId)];
    if (params.unreadOnly) conditions.push(isNull(notifications.readAt));
    if (cursor) {
      conditions.push(
        // (created_at, id) < (cursor)
        lt(notifications.createdAt, cursor.createdAt),
      );
    }
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(params.limit + 1);

    const page = buildPage(rows, params.limit);
    return {
      items: page.items.map((row) => ({
        id: row.id,
        userId: row.userId,
        type: row.type as AppNotification["type"],
        title: row.title,
        body: row.body,
        data: row.data,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async markRead(userId: string, input: { ids?: string[]; all?: boolean }): Promise<number> {
    const now = new Date();
    if (input.all) {
      const result = await this.db
        .update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        .returning({ id: notifications.id });
      return result.length;
    }
    if (!input.ids || input.ids.length === 0) return 0;
    const result = await this.db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, input.ids)))
      .returning({ id: notifications.id });
    return result.length;
  }

  async registerDevice(userId: string, token: string, platform: string): Promise<void> {
    await this.db
      .insert(deviceTokens)
      .values({ userId, token, platform, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { userId, platform, lastSeenAt: new Date() },
      });
  }

  async removeDevice(userId: string, token: string): Promise<void> {
    await this.db
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
  }
}
