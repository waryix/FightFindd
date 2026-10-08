import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar, EmptyState, LoadingState, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import type { ChatMessage, WsClientFrame, WsServerFrame } from "@fightfind/types";
import { api } from "../../../src/api/client";
import { errorMessage } from "../../../src/api/errors";
import { getTokensSync } from "../../../src/storage/token-store";
import { wsUrl } from "../../../src/config";
import { useAuth } from "../../../src/auth/auth-context";

const POLL_INTERVAL_MS = 6000;

export default function ChatScreen() {
  const { matchId, otherName } = useLocalSearchParams<{ matchId: string; otherName: string; otherUserId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "polling">("connecting");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const history = useQuery({
    queryKey: ["messages", matchId],
    queryFn: () => api.messages.history(matchId!, { limit: 50 }),
    enabled: Boolean(matchId),
    refetchInterval: connection === "live" ? false : POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (history.data) {
      setMessages((prev) => {
        const merged = new Map<string, ChatMessage>();
        for (const message of [...history.data.items].reverse()) merged.set(message.id, message);
        for (const message of prev) if (!merged.has(message.id)) merged.set(message.id, message);
        return [...merged.values()].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    }
  }, [history.data]);

  const connect = useCallback(() => {
    if (!matchId) return () => undefined;
    const token = getTokensSync().accessToken;
    if (!token) {
      setConnection("polling");
      return () => undefined;
    }
    setConnection("connecting");
    let closedByUs = false;
    let retry = 0;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      try {
        socket = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`);
      } catch {
        setConnection("polling");
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        retry = 0;
        setConnection("live");
        void api.messages.markRead(matchId).catch(() => undefined);
      };
      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(String(event.data)) as WsServerFrame;
          if (frame.type === "message" && frame.message.matchId === matchId) {
            setMessages((prev) =>
              prev.some((message) => message.id === frame.message.id) ? prev : [...prev, frame.message],
            );
            if (frame.message.senderId !== user?.id) {
              void api.messages.markRead(matchId).catch(() => undefined);
            }
          } else if (frame.type === "read" && frame.readerId !== user?.id) {
            setMessages((prev) => prev.map((message) => (message.readAt ? message : { ...message, readAt: frame.at })));
          } else if (frame.type === "error") {
            setError(frame.message);
          }
        } catch {
          // Ignore malformed frames.
        }
      };
      socket.onclose = () => {
        if (closedByUs) return;
        retry += 1;
        if (retry <= 3) {
          retryTimer = setTimeout(open, Math.min(1000 * 2 ** retry, 8000));
        } else {
          setConnection("polling");
        }
      };
      socket.onerror = () => socket?.close();
    };

    open();
    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [matchId, user?.id]);

  useEffect(() => connect(), [connect]);

  const send = async () => {
    const content = input.trim();
    if (!content || !matchId || sending) return;
    setSending(true);
    setError("");
    const clientId = `local-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: clientId,
      matchId,
      senderId: user?.id ?? "",
      content,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    try {
      const socket = socketRef.current;
      if (connection === "live" && socket && socket.readyState === WebSocket.OPEN) {
        const frame: WsClientFrame = { type: "send_message", matchId, content, clientId };
        socket.send(JSON.stringify(frame));
      } else {
        const { message } = await api.messages.send(matchId, content);
        setMessages((prev) => prev.map((item) => (item.id === clientId ? message : item)));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== clientId));
      setError(errorMessage(err));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const displayMessages = useMemo(() => messages, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <Avatar name={otherName ?? "Fighter"} size={40} />
        <View>
          <AppText variant="bodyStrong">{otherName ?? "Fighter"}</AppText>
          <AppText variant="caption" color={connection === "live" ? theme.colors.success : theme.colors.textMuted}>
            {connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Updating every few seconds"}
          </AppText>
        </View>
      </View>

      {history.isPending ? (
        <LoadingState message="Loading chat…" />
      ) : displayMessages.length === 0 ? (
        <EmptyState title="No messages yet" message="Say hi and plan your rounds." />
      ) : (
        <FlatList
          ref={listRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.id;
            return (
              <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                <AppText variant="body">{item.content}</AppText>
                <AppText variant="caption" style={[styles.time, isMe ? styles.myTime : styles.theirTime]}>
                  {new Date(item.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  {isMe && item.readAt ? " · Read" : ""}
                </AppText>
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />
      )}

      {error ? (
        <AppText variant="caption" color={theme.colors.danger} style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor={theme.colors.textFaint}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <AppText variant="bodyStrong" color="#fff">
            Send
          </AppText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  list: { padding: 16, gap: 6, flexGrow: 1 },
  bubble: { maxWidth: "82%", padding: 12, borderRadius: theme.radii.xl, marginBottom: 4 },
  myBubble: { alignSelf: "flex-end", backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  theirBubble: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  time: { fontSize: 10, marginTop: 4 },
  myTime: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  theirTime: { color: theme.colors.textMuted },
  error: { paddingHorizontal: 16, paddingBottom: 6 },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 110,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.xl,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
});
