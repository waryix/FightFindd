import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { getSession, getToken } from "../../../src/store/session";
import { API_URL } from "../../../src/services/config";

export default function ChatScreen() {
  const { matchId, otherName, otherFighterId } = useLocalSearchParams<{
    matchId: string;
    otherName: string;
    otherFighterId: string;
  }>();

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    loadSession();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (myId) {
      fetchMessages();
      // Poll for new messages every 3 seconds
      pollRef.current = setInterval(fetchMessages, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [myId]);

  const loadSession = async () => {
    const [id, tok] = await Promise.all([getSession(), getToken()]);
    setMyId(id);
    setToken(tok);
  };

  const fetchMessages = async () => {
    try {
      const tok = await getToken();
      const response = await fetch(`${API_URL}/api/messages/${matchId}`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const sendMessage = async () => {
    if (!input.trim() || !myId || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    try {
      const tok = await getToken();
      await fetch(`${API_URL}/api/messages/${matchId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({ sender_id: myId, content }),
      });
      await fetchMessages();
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === myId;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe && item.sender?.name && (
          <Text style={styles.senderName}>{item.sender.name}</Text>
        )}
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.theirMessageTime]}>
          {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.chatHeader}>
        <View style={styles.chatAvatar}>
          <Text style={styles.chatAvatarText}>
            {otherName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.chatName}>{otherName}</Text>
          <Text style={styles.chatStatus}>Sparring partner</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#e63946" size="large" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubText}>Say hi to your sparring partner!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#444"
          value={input}
          onChangeText={setInput}
          color="#fff"
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendBtnText}>Send</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#141414", borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e63946", alignItems: "center", justifyContent: "center" },
  chatAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  chatName: { fontSize: 16, fontWeight: "700", color: "#fff" },
  chatStatus: { fontSize: 12, color: "#666" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  emptySubText: { color: "#666", fontSize: 14 },
  messageList: { padding: 16, gap: 8 },
  messageBubble: { maxWidth: "80%", padding: 12, borderRadius: 16, marginBottom: 4 },
  myBubble: { alignSelf: "flex-end", backgroundColor: "#e63946", borderBottomRightRadius: 4 },
  theirBubble: { alignSelf: "flex-start", backgroundColor: "#1a1a1a", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#2a2a2a" },
  senderName: { fontSize: 11, color: "#888", marginBottom: 4, fontWeight: "600" },
  messageText: { fontSize: 15, lineHeight: 20 },
  myMessageText: { color: "#fff" },
  theirMessageText: { color: "#fff" },
  messageTime: { fontSize: 10, marginTop: 4 },
  myMessageTime: { color: "#ffaaaa", textAlign: "right" },
  theirMessageTime: { color: "#555" },
  inputRow: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: "#141414", borderTopWidth: 1, borderTopColor: "#2a2a2a", alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: "#2a2a2a", maxHeight: 100 },
  sendBtn: { backgroundColor: "#e63946", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
