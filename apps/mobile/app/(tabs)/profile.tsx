import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { getSession, clearSession } from "../../src/store/session";

export default function ProfileScreen() {
  const [fighter, setFighter] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const fighterId = await getSession();
      if (!fighterId) { router.replace("/"); return; }
      const response = await fetch(`http://localhost:4000/api/fighters/${fighterId}`);
      const data = await response.json();
      if (response.ok) setFighter(data.fighter);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    router.replace("/");
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#e63946" size="large" /></View>;
  }

  if (!fighter) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load profile</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {fighter.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{fighter.name}</Text>
        <Text style={styles.location}>{fighter.city}, {fighter.state}</Text>
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
        {fighter.height_cm && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Height</Text>
            <Text style={styles.infoValue}>{fighter.height_cm} cm</Text>
          </View>
        )}
        {fighter.weight_kg && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Weight</Text>
            <Text style={styles.infoValue}>{fighter.weight_kg} kg</Text>
          </View>
        )}
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Age</Text>
          <Text style={styles.infoValue}>{fighter.age_years ?? "—"}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Weight Class</Text>
          <Text style={styles.infoValue}>{fighter.weight_class?.replace("_", " ")}</Text>
        </View>
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

      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => router.push("/(tabs)/edit-profile")}
      >
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
  header: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#e63946", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  name: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  location: { fontSize: 14, color: "#666" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#141414", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#e63946", marginBottom: 2 },
  statLabel: { fontSize: 10, color: "#666", textAlign: "center" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  infoItem: { flex: 1, minWidth: "45%", backgroundColor: "#141414", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  infoLabel: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 16, color: "#fff", fontWeight: "600", textTransform: "capitalize" },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  sectionValue: { fontSize: 16, color: "#fff", fontWeight: "500", textTransform: "capitalize" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipText: { color: "#aaa", fontSize: 13, textTransform: "capitalize" },
  bioText: { fontSize: 14, color: "#888", lineHeight: 20 },
  editBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#e63946", marginBottom: 10 },
  editBtnText: { color: "#e63946", fontSize: 16, fontWeight: "600" },
  logoutBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  logoutText: { color: "#888", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#e63946", fontSize: 16, marginBottom: 12 },
  retryBtn: { backgroundColor: "#1a1a1a", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontSize: 14 },
});
