import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { saveSession } from "../../src/store/session";
import type { Discipline, SkillLevel, WeightClass } from "@repo/types/fighter";

const DISCIPLINES: Discipline[] = ["boxing", "mma", "kickboxing", "muay_thai", "bjj", "wrestling"];
const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "professional"];
const WEIGHT_CLASSES: WeightClass[] = ["flyweight", "bantamweight", "featherweight", "lightweight", "welterweight", "middleweight", "heavyweight"];

export default function ProfileSetupScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [experience, setExperience] = useState("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<Discipline[]>([]);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [weightClass, setWeightClass] = useState<WeightClass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleDiscipline = (d: Discipline) => {
    setSelectedDisciplines(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  const handleSubmit = async () => {
    if (!name || !city || !skillLevel || !weightClass || selectedDisciplines.length === 0) {
      setError("Please fill in all fields and select at least one discipline");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:4000/api/fighters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city,
          state: "Karnataka",
          phone: phone ?? `+91${Date.now()}`,
          latitude: 12.9716,
          longitude: 77.5946,
          discipline: selectedDisciplines,
          skillLevel,
          weightClass,
          ageYears: parseInt(age) || 0,
          yearsExperience: parseInt(experience) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(`Error: ${data.error}`);
        return;
      }

      await saveSession(data.fighter.id);
      router.replace("/(tabs)/discover");
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isValid = name && city && skillLevel && weightClass && selectedDisciplines.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set up your{"\n"}fighter profile</Text>
      <Text style={styles.phone}>Phone: {phone}</Text>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} placeholder="e.g. Arjun Singh" placeholderTextColor="#444" value={name} onChangeText={setName} color="#fff" />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} placeholder="e.g. Bengaluru" placeholderTextColor="#444" value={city} onChangeText={setCity} color="#fff" />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Age</Text>
          <TextInput style={styles.input} placeholder="24" placeholderTextColor="#444" keyboardType="number-pad" value={age} onChangeText={setAge} color="#fff" />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Years Training</Text>
          <TextInput style={styles.input} placeholder="3" placeholderTextColor="#444" keyboardType="number-pad" value={experience} onChangeText={setExperience} color="#fff" />
        </View>
      </View>

      <Text style={styles.label}>Disciplines</Text>
      <View style={styles.chips}>
        {DISCIPLINES.map(d => (
          <TouchableOpacity key={d} style={[styles.chip, selectedDisciplines.includes(d) && styles.chipActive]} onPress={() => toggleDiscipline(d)}>
            <Text style={[styles.chipText, selectedDisciplines.includes(d) && styles.chipTextActive]}>{d.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Skill Level</Text>
      <View style={styles.chips}>
        {SKILL_LEVELS.map(s => (
          <TouchableOpacity key={s} style={[styles.chip, skillLevel === s && styles.chipActive]} onPress={() => setSkillLevel(s)}>
            <Text style={[styles.chipText, skillLevel === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Weight Class</Text>
      <View style={styles.chips}>
        {WEIGHT_CLASSES.map(w => (
          <TouchableOpacity key={w} style={[styles.chip, weightClass === w && styles.chipActive]} onPress={() => setWeightClass(w)}>
            <Text style={[styles.chipText, weightClass === w && styles.chipTextActive]}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.btn, !isValid && styles.btnDisabled]} onPress={handleSubmit} disabled={!isValid || loading}>
        <Text style={styles.btnText}>{loading ? "Creating profile..." : "Start Finding Partners ?"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: "800", color: "#fff", marginBottom: 8, lineHeight: 38 },
  phone: { fontSize: 13, color: "#555", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  row: { flexDirection: "row", gap: 12 },
  halfInput: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  chipText: { color: "#888", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 32 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 16, borderWidth: 1, borderColor: "#e63946" },
});
