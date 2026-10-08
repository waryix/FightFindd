import { analyticsEnabled, API_URL } from "./config";
import { getTokensSync } from "./storage/token-store";

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  occurredAt?: string;
}

const queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  if (queue.length === 0) return;
  const events = queue.splice(0, queue.length);
  try {
    const token = getTokensSync().accessToken;
    await fetch(`${API_URL}/api/v1/analytics/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events }),
    });
  } catch {
    // Analytics is best-effort; drop on failure.
  }
}

/** Fire-and-forget product analytics. Never blocks or fails the UI. */
export function track(name: string, properties?: Record<string, unknown>): void {
  if (!analyticsEnabled) return;
  queue.push({ name, properties, occurredAt: new Date().toISOString() });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), 1500);
}
