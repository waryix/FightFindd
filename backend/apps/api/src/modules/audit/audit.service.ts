import type { Db } from "../../db/client.js";
import { auditLogs } from "../../db/schema.js";

export interface AuditEvent {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail for important state changes, especially anything
 * that moves money. Failures are logged but never break the transaction flow.
 */
export class AuditService {
  constructor(private readonly db: Db) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        actorUserId: event.actorUserId ?? null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        metadata: event.metadata ?? {},
      });
    } catch (error) {
      console.error("[audit] failed to record event", event.action, error);
    }
  }
}
