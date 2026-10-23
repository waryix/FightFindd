import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { router, useFocusEffect } from "expo-router";
import { getSession, getToken } from "../../src/store/session";
import { API_URL } from "../../src/services/config";
import { useHideTabBarOnScroll, useResetTabBarOnFocus } from "../../src/store/tabBar";
import { useWebPullToRefresh } from "../../src/store/pullToRefresh";

type MatchStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

const SKILL_COLOR: Record<string, string> = {
  beginner: "#3b82f6",
  intermediate: "#f59e0b",
  advanced: "#8b5cf6",
  professional: "#22c55e",
};

const STATUS_COLOR: Record<MatchStatus, string> = {
  pending: "#f59e0b",
  accepted: "#22c55e",
  declined: "#e63946",
  completed: "#3b82f6",
  cancelled: "#666666",
};

const STATUS_BG: Record<MatchStatus, string> = {
  pending: "#f59e0b22",
  accepted: "#22c55e22",
  declined: "#e6394622",
  completed: "#3b82f622",
  cancelled: "#66666622",
};

export default function MatchesScreen() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [myId, setMyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const onScroll = useHideTabBarOnScroll();
  useResetTabBarOnFocus();

  useEffect(() => { loadMyId(); }, []);
  useEffect(() => { if (myId) fetchMatches(); }, [myId]);

  const loadMyId = async () => { const id = await getSession(); setMyId(id); };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches(true);
    setRefreshing(false);
  };

  const pullRef = useWebPullToRefresh(onRefresh);

  const fetchMatches = async (silent = false) => {
    if (!myId) return;
    if (!silent) setLoading(true);
    setError("");
    try {
      const tok = await getToken();
      const response = await fetch(`${API_URL}/api/matches?fighter_id=${myId}`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      setMatches(data.matches);
    } catch { setError("Could not connect to server"); }
    finally { if (!silent) setLoading(false); }
  };

  const updateStatus = async (id: string, status: MatchStatus) => {
    try {
      const tok = await getToken();
      await fetch(`${API_URL}/api/matches/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      fetchMatches();
    } catch (err) { console.error(err); }
  };

  const fetchRef = useRef<() => void>(() => {});
  fetchRef.current = () => { fetchMatches(true); };
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      fetchRef.current();
    }, [])
  );

  const received = matches.filter(m => m.receiver_id === myId);
  const sent = matches.filter(m => m.sender_id === myId);
  const displayed = tab === "received" ? received : sent;

  const renderMatch = ({ item }: { item: any }) => {
    const otherFighter = tab === "received" ? item.sender : item.receiver;
    const initials = otherFighter?.name
      ? otherFighter.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
      : "??";

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => otherFighter && router.push({
              pathname: "/fighter/[fighterId]",
              params: { fighterId: otherFighter.id },
            })}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>

          <View style={styles.matchInfo}>
            <Text style={styles.fighterName}>{otherFighter?.name ?? "Unknown Fighter"}</Text>
            <Text style={styles.discipline}>{item.discipline.replace("_", " ")}</Text>
            <Text style={styles.location}>{item.proposed_location}</Text>
            <Text style={styles.date}>
              {new Date(item.proposed_date).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[item.status as MatchStatus], borderColor: STATUS_COLOR[item.status as MatchStatus] + "55" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[item.status as MatchStatus] }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {otherFighter && (
          <View style={styles.fighterTags}>
            {otherFighter.skill_level ? (
              <View style={[styles.skillTag, { backgroundColor: (SKILL_COLOR[otherFighter.skill_level] ?? "#888") + "22", borderColor: SKILL_COLOR[otherFighter.skill_level] ?? "#888" }]}>
                <Text style={[styles.skillTagText, { color: SKILL_COLOR[otherFighter.skill_level] ?? "#888" }]}>{otherFighter.skill_level}</Text>
              </View>
            ) : null}
            {otherFighter.weight_class ? <View style={styles.tag}><Text style={styles.tagText}>{otherFighter.weight_class.replace("_", " ")}</Text></View> : null}
            {otherFighter.city ? <View style={styles.tag}><Text style={styles.tagText}>{otherFighter.city}</Text></View> : null}
          </View>
        )}

        {item.message ? <Text style={styles.message}>"{item.message}"</Text> : null}

        {tab === "received" && item.status === "pending" && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={() => updateStatus(item.id, "declined")}>
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => updateStatus(item.id, "accepted")}>
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === "accepted" && (
          <View style={styles.acceptedActions}>
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => router.push({
                pathname: "/chat/[matchId]",
                params: {
                  matchId: item.id,
                  otherName: otherFighter?.name ?? "Fighter",
                  otherFighterId: otherFighter?.id ?? "",
                },
              })}
            >
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.completeBtn} onPress={() => updateStatus(item.id, "completed")}>
              <Text style={styles.completeBtnText}>Mark Completed</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === "sent" && item.status === "pending" && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => updateStatus(item.id, "cancelled")}>
            <Text style={styles.cancelBtnText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>Your sparring requests</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === "received" && styles.tabBtnActive]} onPress={() => setTab("received")}>
          <Text style={[styles.tabBtnText, tab === "received" && styles.tabBtnTextActive]}>
            Received {received.length > 0 ? `(${received.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === "sent" && styles.tabBtnActive]} onPress={() => setTab("sent")}>
          <Text style={[styles.tabBtnText, tab === "sent" && styles.tabBtnTextActive]}>
            Sent {sent.length > 0 ? `(${sent.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#e63946" size="large" /><Text style={styles.loadingText}>Loading matches...</Text></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryBtn} onPress={() => fetchMatches()}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity></View>
      ) : displayed.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{tab === "received" ? "No requests received yet" : "No requests sent yet"}</Text>
          <Text style={styles.emptySubText}>{tab === "received" ? "When fighters request to spar with you, they'll appear here" : "Go to Discover and send a sparring request"}</Text>
        </View>
      ) : (
        <FlatList
          ref={pullRef}
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={renderMatch}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e63946" colors={["#e63946"]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 14, color: "#666", marginTop: 2 },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabBtnActive: { backgroundColor: "#e63946" },
  tabBtnText: { fontSize: 14, fontWeight: "600", color: "#666" },
  tabBtnTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: "#141414", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  cardTop: { flexDirection: "row", gap: 12, marginBottom: 8, alignItems: "flex-start" },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#e63946", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  matchInfo: { flex: 1, gap: 2 },
  fighterName: { fontSize: 16, fontWeight: "700", color: "#fff" },
  discipline: { fontSize: 13, color: "#e63946", fontWeight: "600", textTransform: "capitalize" },
  location: { fontSize: 12, color: "#888" },
  date: { fontSize: 11, color: "#555" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  fighterTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  skillTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  skillTagText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  tagText: { fontSize: 11, color: "#888", textTransform: "capitalize" },
  message: { fontSize: 13, color: "#666", fontStyle: "italic", marginBottom: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10 },
  declineBtn: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  declineBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
  acceptBtn: { flex: 1, backgroundColor: "#22c55e22", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#22c55e55" },
  acceptBtnText: { color: "#22c55e", fontSize: 14, fontWeight: "600" },
  acceptedActions: { flexDirection: "row", gap: 10 },
  messageBtn: { flex: 1, backgroundColor: "#3b82f622", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#3b82f655" },
  messageBtnText: { color: "#3b82f6", fontSize: 14, fontWeight: "600" },
  completeBtn: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  completeBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
  cancelBtn: { backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  cancelBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { color: "#666", fontSize: 14 },
  errorText: { color: "#e63946", fontSize: 14 },
  retryBtn: { backgroundColor: "#1a1a1a", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontSize: 14 },
  emptyText: { color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center" },
  emptySubText: { color: "#666", fontSize: 14, textAlign: "center" },
});
