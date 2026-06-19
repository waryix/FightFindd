import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import type { Fighter, Discipline, SkillLevel } from "@repo/types/fighter";

const DISCIPLINES: Discipline[] = ["boxing", "mma", "kickboxing", "muay_thai", "bjj", "wrestling"];
const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "professional"];

const SKILL_COLOR: Record<SkillLevel, string> = {
  beginner: "#22c55e",
  intermediate: "#3b82f6",
  advanced: "#f59e0b",
  professional: "#e63946",
};

export default function DiscoverScreen() {
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<Discipline | null>(null);
  const [skillFilter, setSkillFilter] = useState<SkillLevel | null>(null);

  useEffect(() => {
    fetchFighters();
  }, [disciplineFilter, skillFilter]);

  const fetchFighters = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (disciplineFilter) params.append("discipline", disciplineFilter);
      if (skillFilter) params.append("skill_level", skillFilter);

      const response = await fetch(
        `http://localhost:4000/api/fighters?${params.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        return;
      }

      setFighters(data.fighters);
    } catch (err: any) {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSparring = (fighter: any) => {
    router.push({
      pathname: "/(tabs)/request/[receiverId]",
      params: {
        receiverId: fighter.id,
        receiverName: fighter.name,
        receiverSkill: fighter.skill_level,
        receiverDisciplines: JSON.stringify(fighter.discipline),
      },
    });
  };

  const renderFighter = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.fighterName}>{item.name}</Text>
          <Text style={styles.fighterLocation}>{item.city}, {item.state}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.skillTag, { backgroundColor: SKILL_COLOR[item.skill_level as SkillLevel] + "22", borderColor: SKILL_COLOR[item.skill_level as SkillLevel] }]}>
              <Text style={[styles.skillTagText, { color: SKILL_COLOR[item.skill_level as SkillLevel] }]}>
                {item.skill_level}
              </Text>
            </View>
            <View style={styles.weightTag}>
              <Text style={styles.weightTagText}>{item.weight_class}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.disciplines}>
        {item.discipline.map((d: string) => (
          <View key={d} style={styles.disciplineChip}>
            <Text style={styles.disciplineChipText}>{d.replace("_", " ")}</Text>
          </View>
        ))}
      </View>

      {item.bio ? <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text> : null}

      <TouchableOpacity
        style={styles.requestBtn}
        onPress={() => handleRequestSparring(item)}
      >
        <Text style={styles.requestBtnText}>Request Sparring</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSub}>Find sparring partners near you</Text>
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", ...DISCIPLINES]}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, (item === "all" ? disciplineFilter === null : disciplineFilter === item) && styles.filterChipActive]}
              onPress={() => setDisciplineFilter(item === "all" ? null : item as Discipline)}
            >
              <Text style={[styles.filterChipText, (item === "all" ? disciplineFilter === null : disciplineFilter === item) && styles.filterChipTextActive]}>
                {item === "all" ? "All" : item.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.skillFilters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", ...SKILL_LEVELS]}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, (item === "all" ? skillFilter === null : skillFilter === item) && styles.filterChipActive]}
              onPress={() => setSkillFilter(item === "all" ? null : item as SkillLevel)}
            >
              <Text style={[styles.filterChipText, (item === "all" ? skillFilter === null : skillFilter === item) && styles.filterChipTextActive]}>
                {item === "all" ? "All levels" : item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#e63946" size="large" />
          <Text style={styles.loadingText}>Finding fighters...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchFighters}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : fighters.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No fighters found</Text>
          <Text style={styles.emptySubText}>Try changing your filters</Text>
        </View>
      ) : (
        <FlatList
          data={fighters}
          keyExtractor={item => item.id}
          renderItem={renderFighter}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
  filters: { marginBottom: 4 },
  skillFilters: { marginBottom: 8 },
  filterList: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  filterChipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  filterChipText: { color: "#666", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  filterChipTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: "#141414", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  cardTop: { flexDirection: "row", gap: 14, marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#e63946", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cardInfo: { flex: 1, gap: 4 },
  fighterName: { fontSize: 17, fontWeight: "700", color: "#fff" },
  fighterLocation: { fontSize: 13, color: "#666" },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  skillTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  skillTagText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  weightTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  weightTagText: { fontSize: 11, color: "#888", textTransform: "capitalize" },
  disciplines: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  disciplineChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#1a1a1a" },
  disciplineChipText: { fontSize: 12, color: "#888", textTransform: "capitalize" },
  bio: { fontSize: 13, color: "#666", lineHeight: 18, marginBottom: 12 },
  requestBtn: { backgroundColor: "#e6394622", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#e6394655" },
  requestBtnText: { color: "#e63946", fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#666", fontSize: 14 },
  errorText: { color: "#e63946", fontSize: 14 },
  retryBtn: { backgroundColor: "#1a1a1a", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontSize: 14 },
  emptyText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  emptySubText: { color: "#666", fontSize: 14 },
});
