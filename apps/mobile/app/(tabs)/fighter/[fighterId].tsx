import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { getSession } from "../../../src/store/session";
import { API_URL } from "../../../src/services/config";

const SKILL_COLOR: Record<string, string> = {
  beginner: "#22c55e",
  intermediate: "#3b82f6",
  advanced: "#f59e0b",
  professional: "#e63946",
};

export default function FighterDetailScreen() {
  const { fighterId } = useLocalSearchParams<{ fighterId: string }>();
  const [fighter, setFighter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [id, response] = await Promise.all([
        getSession(),
        fetch(`${API_URL}/api/fighters/${fighterId}`),
      ]);
      setMyId(id);
      const data = await response.json();
      if (response.ok) setFighter(data.fighter);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#e63946" size="large" /></View>;
  }

  if (!fighter) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Fighter not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnProfile = myId === fighter.id;
  const skillColor = SKILL_COLOR[fighter.skill_level] ?? "#888";

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
        <View style={[styles.skillBadge, { backgroundColor: skillColor + "22", borderColor: skillColor }]}>
          <Text style={[styles.skillBadgeText, { color: skillColor }]}>{fighter.skill_level}</Text>
        </View>
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
        <Text style={styles.sectionLabel}>Disciplines</Text>
        <View style={styles.chips}>
          {fighter.discipline?.map((d: string) => (
            <View key={d} style={styles.chip}><Text style={styles.chipText}>{d.replace("_", " ")}</Text></View>
          ))}
        </View>
      </View>

      {fighter.bio ? <View style={styles.section}><Text style={styles.sectionLabel}>About</Text><Text style={styles.bioText}>{fighter.bio}</Text></View> : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Location</Text>
        <Text style={styles.infoValue}>{fighter.city}, {fighter.state}</Text>
      </View>

      {!isOwnProfile && (
        <TouchableOpacity
          style={styles.requestBtn}
          onPress={() => router.push({
            pathname: "/(tabs)/request/[receiverId]",
            params: { receiverId: fighter.id, receiverName: fighter.name, receiverSkill: fighter.skill_level, receiverDisciplines: JSON.stringify(fighter.discipline) },
          })}
        >
          <Text style={styles.requestBtnText}>Request Sparring</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", gap: 12 },
  header: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#e63946", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  name: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 4 },
  location: { fontSize: 14, color: "#666", marginBottom: 10 },
  skillBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  skillBadgeText: { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#141414", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#e63946", marginBottom: 2 },
  statLabel: { fontSize: 10, color: "#666", textAlign: "center" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  infoItem: { flex: 1, minWidth: "45%", backgroundColor: "#141414", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  infoLabel: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 15, color: "#fff", fontWeight: "600", textTransform: "capitalize" },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipText: { color: "#aaa", fontSize: 13, textTransform: "capitalize" },
  bioText: { fontSize: 14, color: "#888", lineHeight: 22 },
  requestBtn: { backgroundColor: "#e63946", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 10 },
  requestBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  backBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  backBtnText: { color: "#888", fontSize: 15 },
  errorText: { color: "#e63946", fontSize: 16 },
  backText: { color: "#e63946", fontSize: 14 },
});
