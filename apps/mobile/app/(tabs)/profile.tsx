import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { getSession, clearSession } from "../../src/store/session";
import { API_URL } from "../../src/services/config";
import { upgradeToPro, PRO_PRICE } from "../../src/services/payments";
import Avatar from "../../src/components/Avatar";
import { useWebPullToRefresh } from "../../src/store/pullToRefresh";

export default function ProfileScreen() {
  const [fighter, setFighter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [proMsg, setProMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile(true);
    }, [])
  );

  const loadProfile = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const fighterId = await getSession();
      if (!fighterId) { router.replace("/"); return; }
      const response = await fetch(`${API_URL}/api/fighters/${fighterId}`);
      const data = await response.json();
      if (response.ok) setFighter(data.fighter);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile(true);
    setRefreshing(false);
  };

  const pullRef = useWebPullToRefresh(onRefresh);

  const handleLogout = async () => {
    await clearSession();
    router.replace("/");
  };

  const handleUpgrade = async () => {
    const fighterId = await getSession();
    if (!fighterId) return;
    setUpgrading(true);
    setProMsg("");
    const result = await upgradeToPro(fighterId);
    if (result.success) {
      setProMsg("You're now a Pro member!");
      await loadProfile();
    } else {
      setProMsg(result.error ?? "Upgrade failed");
    }
    setUpgrading(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#e63946" size="large" /></View>;

  if (!fighter) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load profile</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadProfile()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      ref={pullRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e63946" colors={["#e63946"]} />}
    >
      <View style={styles.header}>
        <Avatar
          name={fighter.name}
          avatarUrl={fighter.avatar_url}
          size={90}
          editable
          onUploaded={url => setFighter((prev: any) => ({ ...prev, avatar_url: url }))}
        />
        <Text style={styles.name}>{fighter.name}</Text>
        <Text style={styles.location}>{fighter.city}, {fighter.state}</Text>
        <Text style={styles.tapHint}>Tap photo to change</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fighter.years_experience ?? 0}</Text>
          <Text style={styles.statLabel}>Years Training</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fighter.total_amateur_fights ?? 0}</Text>
          <Text style={styles.statLabel}>Amateur Fights</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fighter.total_pro_fights ?? 0}</Text>
          <Text style={styles.statLabel}>Pro Fights</Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        {fighter.height_cm ? <View style={styles.infoItem}><Text style={styles.infoLabel}>Height</Text><Text style={styles.infoValue}>{fighter.height_cm} cm</Text></View> : null}
        {fighter.weight_kg ? <View style={styles.infoItem}><Text style={styles.infoLabel}>Weight</Text><Text style={styles.infoValue}>{fighter.weight_kg} kg</Text></View> : null}
        {fighter.age_years ? <View style={styles.infoItem}><Text style={styles.infoLabel}>Age</Text><Text style={styles.infoValue}>{fighter.age_years} yrs</Text></View> : null}
        <View style={styles.infoItem}><Text style={styles.infoLabel}>Weight Class</Text><Text style={styles.infoValue}>{fighter.weight_class?.replace("_", " ")}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Skill Level</Text>
        <Text style={styles.sectionValue}>{fighter.skill_level}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Disciplines</Text>
        <View style={styles.chips}>
          {fighter.discipline?.map((d: string) => (
            <View key={d} style={styles.chip}>
              <Text style={styles.chipText}>{d.replace("_", " ")}</Text>
            </View>
          ))}
        </View>
      </View>

      {fighter.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bio</Text>
          <Text style={styles.bioText}>{fighter.bio}</Text>
        </View>
      ) : null}

      <View style={styles.proCard}>
        <View style={styles.proHeader}>
          <Text style={styles.proTitle}>FightFind Pro</Text>
          {fighter.is_pro ? <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View> : null}
        </View>
        {fighter.is_pro ? (
          <Text style={styles.proText}>You have Pro. Priority visibility and a Pro badge on your profile.</Text>
        ) : (
          <>
            <Text style={styles.proText}>Stand out with a Pro badge and priority in search results.</Text>
            {proMsg ? <Text style={styles.proMsg}>{proMsg}</Text> : null}
            <TouchableOpacity style={styles.proBtn} onPress={handleUpgrade} disabled={upgrading}>
              <Text style={styles.proBtnText}>{upgrading ? "Processing…" : `Upgrade to Pro · ₹${PRO_PRICE}`}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/edit-profile")}>
        <Text style={styles.editBtnText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 24, gap: 6 },
  name: { fontSize: 24, fontWeight: "800", color: "#fff" },
  location: { fontSize: 14, color: "#666" },
  tapHint: { fontSize: 11, color: "#444", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#141414", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#e63946", marginBottom: 2 },
  statLabel: { fontSize: 10, color: "#666", textAlign: "center" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  infoItem: { flex: 1, minWidth: "45%", backgroundColor: "#141414", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  infoLabel: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 15, color: "#fff", fontWeight: "600", textTransform: "capitalize" },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  sectionValue: { fontSize: 16, color: "#fff", fontWeight: "500", textTransform: "capitalize" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipText: { color: "#aaa", fontSize: 13, textTransform: "capitalize" },
  bioText: { fontSize: 14, color: "#888", lineHeight: 20 },
  proCard: { backgroundColor: "#141414", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e6394655", marginBottom: 16, gap: 10 },
  proHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  proTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  proBadge: { backgroundColor: "#e6394622", borderWidth: 1, borderColor: "#e63946", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  proBadgeText: { color: "#e63946", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  proText: { fontSize: 13, color: "#888", lineHeight: 18 },
  proMsg: { fontSize: 13, color: "#22c55e" },
  proBtn: { backgroundColor: "#e63946", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  proBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  editBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#e63946", marginBottom: 10 },
  editBtnText: { color: "#e63946", fontSize: 16, fontWeight: "600" },
  logoutBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  logoutText: { color: "#888", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#e63946", fontSize: 16, marginBottom: 12 },
  retryBtn: { backgroundColor: "#1a1a1a", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontSize: 14 },
});
