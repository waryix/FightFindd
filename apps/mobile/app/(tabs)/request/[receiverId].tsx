import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { getSession } from "../../../src/store/session";
import { API_URL } from "../../../src/services/config";
import type { Discipline } from "@repo/types/fighter";

const DISCIPLINES: Discipline[] = ["boxing", "mma", "kickboxing", "muay_thai", "bjj", "wrestling"];

const LOCATIONS = [
  "Knockout Boxing Club, Indiranagar",
  "Iron Fist MMA, Koramangala",
  "Champions Muay Thai, HSR Layout",
  "Combat Zone, Whitefield",
  "Other (specify in message)",
];

export default function RequestSparringScreen() {
  const { receiverId, receiverName, receiverSkill, receiverDisciplines } = useLocalSearchParams<{
    receiverId: string;
    receiverName: string;
    receiverSkill: string;
    receiverDisciplines: string;
  }>();

  const disciplines = JSON.parse(receiverDisciplines ?? "[]") as Discipline[];

  const [discipline, setDiscipline] = useState<Discipline | null>(
    disciplines.length === 1 ? disciplines[0]! : null
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid = discipline && date && time && location;

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const senderId = await getSession();
      if (!senderId) {
        router.replace("/");
        return;
      }

      const proposedDate = new Date(`${date}T${time}:00+05:30`).toISOString();

      const response = await fetch(`${API_URL}/api/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: senderId,
          receiver_id: receiverId,
          discipline,
          proposed_date: proposedDate,
          proposed_location: location,
          message: message.trim() || null,
          status: "pending",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(`Error: ${data.error}`);
        return;
      }

      router.replace("/(tabs)/matches");
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.targetFighter}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {receiverName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.targetName}>{receiverName}</Text>
          <Text style={styles.targetSkill}>{receiverSkill} · {disciplines.join(", ")}</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}

      <Text style={styles.label}>Discipline *</Text>
      <View style={styles.chips}>
        {disciplines.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, discipline === d && styles.chipActive]}
            onPress={() => setDiscipline(d)}
          >
            <Text style={[styles.chipText, discipline === d && styles.chipTextActive]}>
              {d.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 2026-07-15"
        placeholderTextColor="#444"
        value={date}
        onChangeText={setDate}
        color="#fff"
      />

      <Text style={styles.label}>Time * (HH:MM)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 07:00"
        placeholderTextColor="#444"
        value={time}
        onChangeText={setTime}
        color="#fff"
      />

      <Text style={styles.label}>Location *</Text>
      <View style={styles.locationOptions}>
        {LOCATIONS.map(loc => (
          <TouchableOpacity
            key={loc}
            style={[styles.locationBtn, location === loc && styles.locationBtnActive]}
            onPress={() => setLocation(loc)}
          >
            <Text style={[styles.locationBtnText, location === loc && styles.locationBtnTextActive]}>
              {loc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Message (optional)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Tell them about your training goals, what you want to work on..."
        placeholderTextColor="#444"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        color="#fff"
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.btn, !isValid && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Send Sparring Request</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 20, paddingBottom: 60 },
  targetFighter: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#141414", borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: "#2a2a2a" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#e63946", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  targetName: { fontSize: 17, fontWeight: "700", color: "#fff", marginBottom: 2 },
  targetSkill: { fontSize: 13, color: "#666", textTransform: "capitalize" },
  label: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  chipText: { color: "#888", fontSize: 14, fontWeight: "500", textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  locationOptions: { gap: 8 },
  locationBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  locationBtnActive: { borderColor: "#e63946", backgroundColor: "#e6394611" },
  locationBtnText: { color: "#666", fontSize: 14 },
  locationBtnTextActive: { color: "#e63946", fontWeight: "600" },
  textArea: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: "#2a2a2a", minHeight: 100 },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 28 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginTop: 8 },
  cancelBtnText: { color: "#555", fontSize: 15 },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: "#e63946" },
});
