import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, TextInput, RefreshControl } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as Location from "expo-location";
import { getSession } from "../../src/store/session";
import { API_URL } from "../../src/services/config";
import Avatar from "../../src/components/Avatar";
import { Ionicons } from "@expo/vector-icons";
import type { Discipline, SkillLevel, WeightClass } from "@repo/types/fighter";

const DISCIPLINES: Discipline[] = ["boxing", "mma", "kickboxing", "muay_thai", "bjj", "wrestling"];
const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "professional"];
const WEIGHT_CLASSES: WeightClass[] = ["flyweight", "bantamweight", "featherweight", "lightweight", "welterweight", "middleweight", "heavyweight"];

const SKILL_COLOR: Record<SkillLevel, string> = {
  beginner: "#22c55e",
  intermediate: "#3b82f6",
  advanced: "#f59e0b",
  professional: "#e63946",
};

interface Filters {
  discipline: Discipline | null;
  skillLevel: SkillLevel | null;
  weightClass: WeightClass | null;
  city: string;
  minWeight: string;
  maxWeight: string;
  minHeight: string;
  maxHeight: string;
  minExperience: string;
  maxExperience: string;
  minFights: string;
  maxFights: string;
  radiusKm: string;
  useLocation: boolean;
}

const DEFAULT_FILTERS: Filters = {
  discipline: null, skillLevel: null, weightClass: null, city: "",
  minWeight: "", maxWeight: "", minHeight: "", maxHeight: "",
  minExperience: "", maxExperience: "", minFights: "", maxFights: "",
  radiusKm: "25", useLocation: false,
};

export default function DiscoverScreen() {
  const [fighters, setFighters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadMyId(); }, []);
  useEffect(() => { if (myId !== null) fetchFighters(); }, [myId, appliedFilters, searchDebounce]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const loadMyId = async () => { const id = await getSession(); setMyId(id); };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationError("Location permission denied"); return null; }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(coords);
      return coords;
    } catch { setLocationError("Could not get location"); return null; }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFighters(true);
    setRefreshing(false);
  };

  const fetchFighters = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      const f = appliedFilters;
      if (searchDebounce) params.append("search", searchDebounce);
      if (f.discipline) params.append("discipline", f.discipline);
      if (f.skillLevel) params.append("skill_level", f.skillLevel);
      if (f.weightClass) params.append("weight_class", f.weightClass);
      if (f.city) params.append("city", f.city);
      if (f.minWeight) params.append("min_weight", f.minWeight);
      if (f.maxWeight) params.append("max_weight", f.maxWeight);
      if (f.minHeight) params.append("min_height", f.minHeight);
      if (f.maxHeight) params.append("max_height", f.maxHeight);
      if (f.minExperience) params.append("min_experience", f.minExperience);
      if (f.maxExperience) params.append("max_experience", f.maxExperience);
      if (f.minFights) params.append("min_fights", f.minFights);
      if (f.maxFights) params.append("max_fights", f.maxFights);
      if (myId) params.append("exclude_id", myId);
      if (f.useLocation && location) {
        params.append("lat", location.lat.toString());
        params.append("lng", location.lng.toString());
        params.append("radius_km", f.radiusKm || "25");
      }
      const response = await fetch(`${API_URL}/api/fighters?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      setFighters(data.fighters);
    } catch { setError("Could not connect to server"); }
    finally { if (!silent) setLoading(false); }
  };

  const activeFilterCount = Object.entries(appliedFilters).filter(([key, val]) => {
    if (key === "radiusKm") return false;
    if (typeof val === "boolean") return val;
    return val !== null && val !== "";
  }).length;

  const handleApply = () => { setAppliedFilters({ ...filters }); setShowFilters(false); };
  const handleClear = () => { setFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setShowFilters(false); };
  const update = (key: keyof Filters, val: any) => setFilters(prev => ({ ...prev, [key]: val }));

  const handleLocationToggle = async () => {
    if (!filters.useLocation && !location) {
      const coords = await requestLocation();
      if (!coords) return;
    }
    setFilters(prev => ({ ...prev, useLocation: !prev.useLocation }));
  };

  const renderFighter = ({ item }: { item: any }) => {
    const skillColor = SKILL_COLOR[item.skill_level as SkillLevel] ?? "#888";
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: "/(tabs)/fighter/[fighterId]", params: { fighterId: item.id } })}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <Avatar name={item.name} avatarUrl={item.avatar_url} size={52} />
          <View style={styles.cardInfo}>
            <Text style={styles.fighterName}>{item.name}</Text>
            <Text style={styles.fighterLocation}>{item.city}, {item.state}</Text>
            <View style={styles.tagRow}>
              <View style={[styles.skillTag, { backgroundColor: skillColor + "22", borderColor: skillColor }]}>
                <Text style={[styles.skillTagText, { color: skillColor }]}>{item.skill_level}</Text>
              </View>
              <View style={styles.tag}><Text style={styles.tagText}>{item.weight_class?.replace("_", " ")}</Text></View>
              {item.weight_kg ? <View style={styles.tag}><Text style={styles.tagText}>{item.weight_kg}kg</Text></View> : null}
              {item.height_cm ? <View style={styles.tag}><Text style={styles.tagText}>{item.height_cm}cm</Text></View> : null}
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statValue}>{item.years_experience ?? 0}</Text><Text style={styles.statLabel}>yrs exp</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statValue}>{item.total_amateur_fights ?? 0}</Text><Text style={styles.statLabel}>amateur</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statValue}>{item.total_pro_fights ?? 0}</Text><Text style={styles.statLabel}>pro fights</Text></View>
        </View>

        <View style={styles.disciplines}>
          {item.discipline?.map((d: string) => (
            <View key={d} style={styles.disciplineChip}>
              <Text style={styles.disciplineChipText}>{d.replace("_", " ")}</Text>
            </View>
          ))}
        </View>

        {item.bio ? <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text> : null}

        <View style={styles.cardFooter}>
          <View style={styles.viewProfileRow}>
            <Text style={styles.viewProfile}>View full profile</Text>
            <Ionicons name="arrow-forward" size={14} color="#e63946" />
          </View>
          <TouchableOpacity
            style={styles.requestBtn}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: "/(tabs)/request/[receiverId]",
                params: { receiverId: item.id, receiverName: item.name, receiverSkill: item.skill_level, receiverDisciplines: JSON.stringify(item.discipline) },
              });
            }}
          >
            <Text style={styles.requestBtnText}>Request Sparring</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSub}>
            {appliedFilters.useLocation && location ? `Within ${appliedFilters.radiusKm}km of you` : "Find sparring partners"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, showSearch && styles.iconBtnActive]}
            onPress={() => setShowSearch(v => !v)}
          >
            <Ionicons name="search" size={18} color={showSearch ? "#e63946" : "#888888"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnActive]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="funnel-outline" size={18} color={activeFilterCount > 0 ? "#e63946" : "#888888"} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch ? (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#555555" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or city..."
            placeholderTextColor="#444"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity style={styles.clearSearch} onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#555555" />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <View style={styles.disciplineRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", ...DISCIPLINES]}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, (item === "all" ? appliedFilters.discipline === null : appliedFilters.discipline === item) && styles.filterChipActive]}
              onPress={() => {
                const val = item === "all" ? null : item as Discipline;
                setFilters(prev => ({ ...prev, discipline: val }));
                setAppliedFilters(prev => ({ ...prev, discipline: val }));
              }}
            >
              <Text style={[styles.filterChipText, (item === "all" ? appliedFilters.discipline === null : appliedFilters.discipline === item) && styles.filterChipTextActive]}>
                {item === "all" ? "All" : item.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#e63946" size="large" /><Text style={styles.loadingText}>Finding fighters...</Text></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryBtn} onPress={() => fetchFighters()}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity></View>
      ) : fighters.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No fighters found</Text>
          <Text style={styles.emptySubText}>Try a different search or adjust filters</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleClear}><Text style={styles.retryBtnText}>Clear filters</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={fighters}
          keyExtractor={item => item.id}
          renderItem={renderFighter}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e63946" colors={["#e63946"]} />}
        />
      )}

      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={handleClear}><Text style={styles.clearText}>Clear all</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalSection}>Location</Text>
              <TextInput style={styles.modalInput} placeholder="Search by city (e.g. Bengaluru)" placeholderTextColor="#444" value={filters.city} onChangeText={val => update("city", val)} color="#fff" />
              <TouchableOpacity style={[styles.locationToggle, filters.useLocation && styles.locationToggleActive]} onPress={handleLocationToggle}>
                <Text style={[styles.locationToggleText, filters.useLocation && styles.locationToggleTextActive]}>
                  {filters.useLocation ? "Using my location" : "Filter by my location"}
                </Text>
              </TouchableOpacity>
              {locationError ? <Text style={styles.locationError}>{locationError}</Text> : null}
              {filters.useLocation && (
                <>
                  <Text style={styles.modalLabel}>Radius (km)</Text>
                  <TextInput style={styles.modalInput} placeholder="25" placeholderTextColor="#444" keyboardType="number-pad" value={filters.radiusKm} onChangeText={val => update("radiusKm", val)} color="#fff" />
                </>
              )}

              <Text style={styles.modalSection}>Physical</Text>
              <Text style={styles.modalLabel}>Weight (kg)</Text>
              <View style={styles.rangeRow}>
                <TextInput style={styles.rangeInput} placeholder="Min" placeholderTextColor="#444" keyboardType="decimal-pad" value={filters.minWeight} onChangeText={val => update("minWeight", val)} color="#fff" />
                <Text style={styles.rangeSep}>to</Text>
                <TextInput style={styles.rangeInput} placeholder="Max" placeholderTextColor="#444" keyboardType="decimal-pad" value={filters.maxWeight} onChangeText={val => update("maxWeight", val)} color="#fff" />
              </View>
              <Text style={styles.modalLabel}>Height (cm)</Text>
              <View style={styles.rangeRow}>
                <TextInput style={styles.rangeInput} placeholder="Min" placeholderTextColor="#444" keyboardType="number-pad" value={filters.minHeight} onChangeText={val => update("minHeight", val)} color="#fff" />
                <Text style={styles.rangeSep}>to</Text>
                <TextInput style={styles.rangeInput} placeholder="Max" placeholderTextColor="#444" keyboardType="number-pad" value={filters.maxHeight} onChangeText={val => update("maxHeight", val)} color="#fff" />
              </View>
              <Text style={styles.modalLabel}>Weight Class</Text>
              <View style={styles.chips}>
                {WEIGHT_CLASSES.map(w => (
                  <TouchableOpacity key={w} style={[styles.chip, filters.weightClass === w && styles.chipActive]} onPress={() => update("weightClass", filters.weightClass === w ? null : w)}>
                    <Text style={[styles.chipText, filters.weightClass === w && styles.chipTextActive]}>{w.replace("_", " ")}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalSection}>Experience</Text>
              <Text style={styles.modalLabel}>Years Training</Text>
              <View style={styles.rangeRow}>
                <TextInput style={styles.rangeInput} placeholder="Min" placeholderTextColor="#444" keyboardType="number-pad" value={filters.minExperience} onChangeText={val => update("minExperience", val)} color="#fff" />
                <Text style={styles.rangeSep}>to</Text>
                <TextInput style={styles.rangeInput} placeholder="Max" placeholderTextColor="#444" keyboardType="number-pad" value={filters.maxExperience} onChangeText={val => update("maxExperience", val)} color="#fff" />
              </View>
              <Text style={styles.modalLabel}>Total Fights</Text>
              <View style={styles.rangeRow}>
                <TextInput style={styles.rangeInput} placeholder="Min" placeholderTextColor="#444" keyboardType="number-pad" value={filters.minFights} onChangeText={val => update("minFights", val)} color="#fff" />
                <Text style={styles.rangeSep}>to</Text>
                <TextInput style={styles.rangeInput} placeholder="Max" placeholderTextColor="#444" keyboardType="number-pad" value={filters.maxFights} onChangeText={val => update("maxFights", val)} color="#fff" />
              </View>

              <Text style={styles.modalSection}>Skill & Style</Text>
              <Text style={styles.modalLabel}>Skill Level</Text>
              <View style={styles.chips}>
                {SKILL_LEVELS.map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, filters.skillLevel === s && styles.chipActive]} onPress={() => update("skillLevel", filters.skillLevel === s ? null : s)}>
                    <Text style={[styles.chipText, filters.skillLevel === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1a1a1a", borderRadius: 12, borderWidth: 1, borderColor: "#2a2a2a", paddingHorizontal: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#ffffff" },
  clearSearch: { padding: 6 },
  disciplineRow: { marginBottom: 8 },
  filterList: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  filterChipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  filterChipText: { color: "#666", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  filterChipTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: "#141414", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  cardTop: { flexDirection: "row", gap: 14, marginBottom: 10 },
  cardInfo: { flex: 1, gap: 4 },
  fighterName: { fontSize: 17, fontWeight: "700", color: "#fff" },
  fighterLocation: { fontSize: 13, color: "#666" },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 2, flexWrap: "wrap" },
  skillTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  skillTagText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  tagText: { fontSize: 11, color: "#888", textTransform: "capitalize" },
  statsRow: { flexDirection: "row", backgroundColor: "#1a1a1a", borderRadius: 10, padding: 10, marginBottom: 10, alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 10, color: "#555", marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: "#2a2a2a" },
  disciplines: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  disciplineChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#1a1a1a" },
  disciplineChipText: { fontSize: 12, color: "#888", textTransform: "capitalize" },
  bio: { fontSize: 13, color: "#666", lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  viewProfileRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  viewProfile: { color: "#e63946", fontSize: 13, fontWeight: "600" },
  requestBtn: { backgroundColor: "#e6394622", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#e6394655" },
  requestBtnText: { color: "#e63946", fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { color: "#666", fontSize: 14 },
  errorText: { color: "#e63946", fontSize: 14 },
  retryBtn: { backgroundColor: "#1a1a1a", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontSize: 14 },
  emptyText: { color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center" },
  emptySubText: { color: "#666", fontSize: 14, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "#000000aa", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#141414", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: "#2a2a2a" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  clearText: { color: "#e63946", fontSize: 14, fontWeight: "600" },
  modalSection: { fontSize: 15, fontWeight: "700", color: "#fff", marginTop: 20, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#2a2a2a", paddingBottom: 6 },
  modalLabel: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  modalInput: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: "#ffffff", borderWidth: 1, borderColor: "#2a2a2a", marginBottom: 8 },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rangeInput: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#ffffff", borderWidth: 1, borderColor: "#2a2a2a" },
  rangeSep: { color: "#555", fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  chipText: { color: "#888", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  locationToggle: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#2a2a2a", marginBottom: 4 },
  locationToggleActive: { borderColor: "#e63946", backgroundColor: "#e6394611" },
  locationToggleText: { color: "#666", fontSize: 14, fontWeight: "600" },
  locationToggleTextActive: { color: "#e63946" },
  locationError: { color: "#e63946", fontSize: 12, marginTop: 4 },
  applyBtn: { backgroundColor: "#e63946", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  applyBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
