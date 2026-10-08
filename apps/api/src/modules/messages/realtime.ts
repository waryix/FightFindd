import type { WebSocket } from "ws";
import type { MessagesService } from "./messages.service.js";
import type { SparringService } from "../sparring/sparring.service.js";
import type { WsClientFrame, WsServerFrame } from "@fightfind/types";

interface Connection {
  socket: WebSocket;
  userId: string;
  matchIds: Set<string>;
}

/**
 * WebSocket hub for chat. Authenticated users subscribe to their matches and
 * receive messages in real time; REST polling remains available as fallback.
 */
export class ChatHub {
  private readonly connections = new Map<string, Connection>();

  constructor(
    private readonly messages: MessagesService,
    private readonly sparring: SparringService,
  ) {}

  connect(socket: WebSocket, userId: string): void {
    const id = crypto.randomUUID();
    const connection: Connection = { socket, userId, matchIds: new Set() };
    this.connections.set(id, connection);
    socket.on("close", () => this.connections.delete(id));
    socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
      void this.handleFrame(connection, raw.toString());
    });
    socket.on("error", () => this.connections.delete(id));
    this.send(connection, { type: "ready" });
  }

  private async handleFrame(connection: Connection, raw: string): Promise<void> {
    let frame: WsClientFrame;
    try {
      frame = JSON.parse(raw) as WsClientFrame;
    } catch {
      this.send(connection, { type: "error", code: "VALIDATION_ERROR", message: "Malformed frame" });
      return;
    }

    try {
      switch (frame.type) {
        case "ping":
          this.send(connection, { type: "pong" });
          return;
        case "send_message": {
          const message = await this.messages.send(frame.matchId, connection.userId, frame.content);
          connection.matchIds.add(frame.matchId);
          this.broadcast(frame.matchId, { type: "message", message, clientId: frame.clientId });
          return;
        }
        case "read_messages": {
          await this.messages.markRead(frame.matchId, connection.userId);
          this.broadcast(frame.matchId, {
            type: "read",
            matchId: frame.matchId,
            readerId: connection.userId,
            at: new Date().toISOString(),
          });
          return;
        }
        default:
          this.send(connection, { type: "error", code: "VALIDATION_ERROR", message: "Unknown frame type" });
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "INTERNAL_ERROR";
      const message = error instanceof Error ? error.message : "Message failed";
      this.send(connection, { type: "error", code, message, clientId: (frame as { clientId?: string }).clientId });
    }
  }

  /** Push a message to every connected participant of a match. */
  broadcast(matchId: string, frame: WsServerFrame): void {
    void this.sparring.getRaw(matchId).then((match) => {
      if (!match) return;
      for (const connection of this.connections.values()) {
        const isParticipant = connection.userId === match.senderId || connection.userId === match.receiverId;
        if (!isParticipant) continue;
        if (connection.matchIds.size > 0 && !connection.matchIds.has(matchId) && frame.type === "message") {
          // Still deliver: participant is connected but has not "joined" the match yet.
        }
        this.send(connection, frame);
      }
    });
  }

  private send(connection: Connection, frame: WsServerFrame): void {
    if (connection.socket.readyState === connection.socket.OPEN) {
      connection.socket.send(JSON.stringify(frame));
    }
  }

  closeAll(): void {
    for (const connection of this.connections.values()) {
      connection.socket.close();
    }
    this.connections.clear();
  }
}
