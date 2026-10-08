import type { Db } from "../../db/client.js";
import { analyticsEvents } from "../../db/schema.js";
import { loadEnv } from "../../env.js";

export interface AnalyticsSink {
  capture(event: { name: string; userId?: string | null; properties?: Record<string, unknown> }): Promise<void>;
}

class LogSink implements AnalyticsSink {
  async capture(event: { name: string; userId?: string | null; properties?: Record<string, unknown> }) {
    console.log(`[analytics] ${event.name}`, JSON.stringify({ userId: event.userId, ...event.properties }));
  }
}

class NoopSink implements AnalyticsSink {
  async capture() {}
}

class PostHogSink implements AnalyticsSink {
  constructor(
    private readonly apiKey: string,
    private readonly host: string,
  ) {}
  async capture(event: { name: string; userId?: string | null; properties?: Record<string, unknown> }) {
    try {
      await fetch(`${this.host}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          event: event.name,
          distinct_id: event.userId ?? "anonymous",
          properties: event.properties ?? {},
        }),
      });
    } catch (error) {
      console.warn("[analytics] posthog capture failed (ignored)", error);
    }
  }
}

export function createAnalyticsSink(): AnalyticsSink {
  const env = loadEnv();
  switch (env.ANALYTICS_SINK) {
    case "none":
      return new NoopSink();
    case "posthog":
      return env.POSTHOG_API_KEY
        ? new PostHogSink(env.POSTHOG_API_KEY, env.POSTHOG_HOST)
        : new LogSink();
    default:
      return new LogSink();
  }
}

export class AnalyticsService {
  constructor(
    private readonly db: Db,
    private readonly sink: AnalyticsSink,
  ) {}

  /** Records a product event. Best-effort: never fails the request. */
  async track(name: string, params: { userId?: string | null; properties?: Record<string, unknown> } = {}) {
    try {
      await this.db.insert(analyticsEvents).values({
        userId: params.userId ?? null,
        name,
        properties: params.properties ?? {},
      });
    } catch (error) {
      console.warn("[analytics] db insert failed (ignored)", error);
    }
    await this.sink.capture({ name, userId: params.userId, properties: params.properties });
  }

  async trackBatch(
    events: { name: string; properties?: Record<string, unknown>; occurredAt?: string }[],
    userId?: string | null,
  ) {
    for (const event of events) {
      await this.track(event.name, { userId, properties: event.properties });
    }
  }
}
