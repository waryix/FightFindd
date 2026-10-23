import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { API_URL } from "../../src/services/config";

const DISCIPLINE_COLOR: Record<string, string> = {
  boxing: "#3b82f6",
  mma: "#e63946",
  muay_thai: "#f59e0b",
  kickboxing: "#8b5cf6",
  bjj: "#22c55e",
  wrestling: "#f97316",
  mixed: "#06b6d4",
};

export default function GymDetailScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const [gym, setGym] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gymId) return;
    setLoading(true);
    setGym(null);
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/gyms/${gymId}`);
        const data = await response.json();
        if (response.ok) setGym(data.gym);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [gymId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#e63946" size="large" /></View>;
  }

  if (!gym) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Gym not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backText}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const mapsQuery =
    gym.latitude != null && gym.longitude != null
      ? `${gym.latitude},${gym.longitude}`
      : [gym.name, gym.address, gym.city, gym.state, gym.pincode].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>
            {gym.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{gym.name}</Text>
          {gym.is_verified ? <View style={styles.verified}><Text style={styles.verifiedText}>Verified</Text></View> : null}
        </View>
        <Text style={styles.location}>{gym.address}</Text>
        <Text style={styles.city}>{gym.city}, {gym.state}{gym.pincode ? ` ${gym.pincode}` : ""}</Text>
        <TouchableOpacity style={styles.mapBtn} onPress={() => Linking.openURL(mapsUrl)}>
          <Ionicons name="location-outline" size={18} color="#ffffff" />
          <Text style={styles.mapBtnText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.disciplines}>
        {(gym.disciplines ?? []).map((d: string) => (
          <View key={d} style={[styles.chip, { borderColor: DISCIPLINE_COLOR[d] ?? "#333" }]}>
            <Text style={[styles.chipText, { color: DISCIPLINE_COLOR[d] ?? "#888" }]}>{d.replace("_", " ")}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoGrid}>
        {gym.timings ? <View style={styles.infoItem}><Text style={styles.infoLabel}>Timings</Text><Text style={styles.infoValue}>{gym.timings}</Text></View> : null}
        {gym.monthly_fee_inr ? <View style={styles.infoItem}><Text style={styles.infoLabel}>Monthly Fee</Text><Text style={styles.infoValue}>₹{gym.monthly_fee_inr.toLocaleString("en-IN")}</Text></View> : null}
        {gym.phone ? <View style={styles.infoItem}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue}>{gym.phone}</Text></View> : null}
      </View>

      {gym.has_trial_class ? (
        <View style={styles.trial}><Text style={styles.trialText}>Free trial class available</Text></View>
      ) : null}

      {gym.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <Text style={styles.bioText}>{gym.description}</Text>
        </View>
      ) : null}

      {gym.phone ? (
        <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${gym.phone}`)}>
          <Text style={styles.callBtnText}>Call Gym</Text>
        </TouchableOpacity>
      ) : null}

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
  header: { alignItems: "center", marginBottom: 20, gap: 6 },
  icon: { width: 84, height: 84, borderRadius: 22, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  iconText: { color: "#e63946", fontSize: 26, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center" },
  verified: { backgroundColor: "#22c55e22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#22c55e55" },
  verifiedText: { color: "#22c55e", fontSize: 10, fontWeight: "600" },
  location: { fontSize: 14, color: "#888", textAlign: "center" },
  city: { fontSize: 13, color: "#666" },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 8 },
  mapBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  disciplines: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 18 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#1a1a1a", borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "500", textTransform: "capitalize" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  infoItem: { flex: 1, minWidth: "45%", backgroundColor: "#141414", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  infoLabel: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 15, color: "#fff", fontWeight: "600" },
  trial: { backgroundColor: "#22c55e11", borderWidth: 1, borderColor: "#22c55e33", borderRadius: 10, padding: 10, marginBottom: 16 },
  trialText: { color: "#22c55e", fontSize: 13, fontWeight: "700" },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  bioText: { fontSize: 14, color: "#888", lineHeight: 22 },
  callBtn: { backgroundColor: "#e63946", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 10 },
  callBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  backBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  backBtnText: { color: "#888", fontSize: 15 },
  errorText: { color: "#e63946", fontSize: 16 },
  backText: { color: "#e63946", fontSize: 14 },
});
