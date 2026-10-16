import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../../src/services/config";

const DISCIPLINE_FILTERS = ["all", "boxing", "mma", "muay_thai", "kickboxing", "bjj", "wrestling"];

const DISCIPLINE_COLOR: Record<string, string> = {
  boxing: "#3b82f6", mma: "#e63946", muay_thai: "#f59e0b",
  kickboxing: "#8b5cf6", bjj: "#22c55e", wrestling: "#f97316",
};

export default function GymsScreen() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [trialOnly, setTrialOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const activeFilterCount = (filter ? 1 : 0) + (trialOnly ? 1 : 0);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchGyms(); }, [filter, searchDebounce, trialOnly]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGyms(true);
    setRefreshing(false);
  };

  const fetchGyms = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (searchDebounce) params.append("search", searchDebounce);
      if (filter) params.append("discipline", filter);
      if (trialOnly) params.append("has_trial", "true");

      const response = await fetch(`${API_URL}/api/gyms?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      setGyms(data.gyms);
    } catch { setError("Could not connect to server"); }
    finally { if (!silent) setLoading(false); }
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
              <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>Verified</Text></View>
            )}
          </View>
          <Text style={styles.gymAddress}>{item.address}</Text>
          <Text style={styles.gymCity}>{item.city}, {item.state}</Text>
        </View>
      </View>

      <View style={styles.disciplines}>
        {item.disciplines.map((d: string) => (
          <View key={d} style={[styles.disciplineChip, { borderColor: DISCIPLINE_COLOR[d] ?? "#333" }]}>
            <Text style={[styles.disciplineText, { color: DISCIPLINE_COLOR[d] ?? "#888" }]}>{d.replace("_", " ")}</Text>
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
            <Text style={styles.metaValue}>₹{item.monthly_fee_inr.toLocaleString("en-IN")}</Text>
          </View>
        )}
      </View>

      {item.has_trial_class && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialText}>Free trial class available</Text>
        </View>
      )}

      {item.description && <Text style={styles.description} numberOfLines={2}>{item.description}</Text>}

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
        {showSearch ? (
          <View style={styles.inlineSearch}>
            <Ionicons name="search" size={14} color="#555555" />
            <TextInput
              style={styles.inlineSearchInput}
              placeholder="Search"
              placeholderTextColor="#444"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={14} color="#555555" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Nearby Gyms</Text>
            <Text style={styles.headerSub}>Boxing, MMA and combat sports gyms</Text>
          </View>
        )}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, showSearch && styles.iconBtnActive]}
            onPress={() => setShowSearch(v => !v)}
          >
            <Ionicons name={showSearch ? "close" : "search"} size={16} color={showSearch ? "#e63946" : "#888888"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnActive]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Ionicons name="funnel-outline" size={16} color={activeFilterCount > 0 ? "#e63946" : "#888888"} />
          </TouchableOpacity>
        </View>
      </View>

      {showFilters ? (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={DISCIPLINE_FILTERS}
              keyExtractor={item => item}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.filterChip, (item === "all" ? filter === null : filter === item) && styles.filterChipActive]}
                  onPress={() => setFilter(item === "all" ? null : item)}
                >
                  <Text style={[styles.filterChipText, (item === "all" ? filter === null : filter === item) && styles.filterChipTextActive]}>
                    {item === "all" ? "All" : item.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          <TouchableOpacity
            style={[styles.trialToggle, trialOnly && styles.trialToggleActive]}
            onPress={() => setTrialOnly(!trialOnly)}
          >
            <Text style={[styles.trialToggleText, trialOnly && styles.trialToggleTextActive]}>
              {trialOnly ? "Showing: Free trial only" : "Show free trial gyms only"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#e63946" size="large" /><Text style={styles.loadingText}>Finding gyms...</Text></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryBtn} onPress={() => fetchGyms()}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity></View>
      ) : gyms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No gyms found</Text>
          <Text style={styles.emptySubText}>Try a different search</Text>
        </View>
      ) : (
        <FlatList
          data={gyms}
          keyExtractor={item => item.id}
          renderItem={renderGym}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e63946" colors={["#e63946"]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 14, color: "#666", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  iconBtnActive: { backgroundColor: "#e6394622", borderColor: "#e63946" },
  inlineSearch: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1a1a1a", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#2a2a2a" },
  inlineSearchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 14, color: "#ffffff" },
  filterPanel: { marginBottom: 4 },
  filterRow: { marginBottom: 8 },
  filterList: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  filterChipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  filterChipText: { color: "#666", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  filterChipTextActive: { color: "#fff" },
  trialToggle: { marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#2a2a2a", alignSelf: "flex-start" },
  trialToggleActive: { backgroundColor: "#22c55e22", borderColor: "#22c55e" },
  trialToggleText: { color: "#666", fontSize: 13, fontWeight: "500" },
  trialToggleTextActive: { color: "#22c55e" },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
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
