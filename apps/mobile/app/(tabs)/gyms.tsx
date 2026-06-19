import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";

const DISCIPLINE_FILTERS = ["all", "boxing", "mma", "muay_thai", "kickboxing", "bjj", "wrestling"];

const DISCIPLINE_COLOR: Record<string, string> = {
  boxing: "#3b82f6",
  mma: "#e63946",
  muay_thai: "#f59e0b",
  kickboxing: "#8b5cf6",
  bjj: "#22c55e",
  wrestling: "#f97316",
};

export default function GymsScreen() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchGyms();
  }, [filter]);

  const fetchGyms = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filter) params.append("discipline", filter);

      const response = await fetch(
        `http://localhost:4000/api/gyms?${params.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        return;
      }

      setGyms(data.gyms);
    } catch (err: any) {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const renderGym = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.gymIcon}>
          <Text style={styles.gymIconText}>
            {item.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.gymInfo}>
          <View style={styles.gymNameRow}>
            <Text style={styles.gymName}>{item.name}</Text>
            {item.is_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.gymAddress}>{item.address}</Text>
          <Text style={styles.gymCity}>{item.city}, {item.state}</Text>
        </View>
      </View>

      <View style={styles.disciplines}>
        {item.disciplines.map((d: string) => (
          <View key={d} style={[styles.disciplineChip, { borderColor: DISCIPLINE_COLOR[d] ?? "#333" }]}>
            <Text style={[styles.disciplineText, { color: DISCIPLINE_COLOR[d] ?? "#888" }]}>
              {d.replace("_", " ")}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Timings</Text>
          <Text style={styles.metaValue}>{item.timings}</Text>
        </View>
        {item.monthly_fee_inr && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Monthly Fee</Text>
            <Text style={styles.metaValue}>Rs. {item.monthly_fee_inr.toLocaleString("en-IN")}</Text>
          </View>
        )}
      </View>

      {item.has_trial_class && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialText}>Free trial class available</Text>
        </View>
      )}

      {item.description && (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.callBtn}>
          <Text style={styles.callBtnText}>Call Gym</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.detailsBtn}>
          <Text style={styles.detailsBtnText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby Gyms</Text>
        <Text style={styles.headerSub}>Boxing, MMA and combat sports gyms</Text>
      </View>

      <View style={styles.filterWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={DISCIPLINE_FILTERS}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                (item === "all" ? filter === null : filter === item) && styles.filterChipActive
              ]}
              onPress={() => setFilter(item === "all" ? null : item)}
            >
              <Text style={[
                styles.filterChipText,
                (item === "all" ? filter === null : filter === item) && styles.filterChipTextActive
              ]}>
                {item === "all" ? "All" : item.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#e63946" size="large" />
          <Text style={styles.loadingText}>Finding gyms...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchGyms}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : gyms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No gyms found</Text>
          <Text style={styles.emptySubText}>Try changing your filters</Text>
        </View>
      ) : (
        <FlatList
          data={gyms}
          keyExtractor={item => item.id}
          renderItem={renderGym}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 14, color: "#666", marginTop: 2 },
  filterWrapper: { paddingBottom: 12 },
  filterList: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  filterChipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  filterChipText: { color: "#666", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  filterChipTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: "#141414", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  cardHeader: { flexDirection: "row", gap: 14, marginBottom: 12 },
  gymIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  gymIconText: { color: "#e63946", fontSize: 16, fontWeight: "800" },
  gymInfo: { flex: 1 },
  gymNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  gymName: { fontSize: 16, fontWeight: "700", color: "#fff", flex: 1 },
  verifiedBadge: { backgroundColor: "#22c55e22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#22c55e55" },
  verifiedText: { color: "#22c55e", fontSize: 10, fontWeight: "600" },
  gymAddress: { fontSize: 12, color: "#666" },
  gymCity: { fontSize: 12, color: "#555" },
  disciplines: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  disciplineChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#1a1a1a", borderWidth: 1 },
  disciplineText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 10 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 13, color: "#aaa", fontWeight: "500" },
  trialBanner: { backgroundColor: "#22c55e11", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10, borderWidth: 1, borderColor: "#22c55e33" },
  trialText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },
  description: { fontSize: 13, color: "#666", lineHeight: 18, marginBottom: 12 },
  cardActions: { flexDirection: "row", gap: 10 },
  callBtn: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  callBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  detailsBtn: { flex: 1, backgroundColor: "#e6394622", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#e6394655" },
  detailsBtnText: { color: "#e63946", fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#666", fontSize: 14 },
  errorText: { color: "#e63946", fontSize: 14 },
  retryBtn: { backgroundColor: "#1a1a1a", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontSize: 14 },
  emptyText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  emptySubText: { color: "#666", fontSize: 14 },
});
