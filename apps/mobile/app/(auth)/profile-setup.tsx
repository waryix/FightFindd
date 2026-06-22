import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { saveSession } from "../../src/store/session";
import type { Discipline, SkillLevel, WeightClass } from "@repo/types/fighter";

const DISCIPLINES: Discipline[] = ["boxing", "mma", "kickboxing", "muay_thai", "bjj", "wrestling"];
const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "professional"];
const WEIGHT_CLASSES: WeightClass[] = ["flyweight", "bantamweight", "featherweight", "lightweight", "welterweight", "middleweight", "heavyweight"];

const WEIGHT_CLASS_RANGES: Record<WeightClass, string> = {
  flyweight: "up to 52kg",
  bantamweight: "52–56kg",
  featherweight: "56–60kg",
  lightweight: "60–65kg",
  welterweight: "65–70kg",
  middleweight: "70–75kg",
  heavyweight: "75kg+",
};

function suggestWeightClass(weightKg: number): WeightClass {
  if (weightKg <= 52) return "flyweight";
  if (weightKg <= 56) return "bantamweight";
  if (weightKg <= 60) return "featherweight";
  if (weightKg <= 65) return "lightweight";
  if (weightKg <= 70) return "welterweight";
  if (weightKg <= 75) return "middleweight";
  return "heavyweight";
}

export default function ProfileSetupScreen() {
  const { phone, email, name: passedName } = useLocalSearchParams<{ phone: string; email: string; name: string }>();

  const [name, setName] = useState(passedName ?? "");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [age, setAge] = useState("");
  const [experience, setExperience] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [amateurFights, setAmateurFights] = useState("");
  const [proFights, setProFights] = useState("");
  const [bio, setBio] = useState("");
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

  const handleWeightChange = (val: string) => {
    setWeightKg(val);
    const kg = parseFloat(val);
    if (!isNaN(kg) && kg > 0) {
      setWeightClass(suggestWeightClass(kg));
    }
  };

  const handleSubmit = async () => {
    if (!name || !city || !state || !skillLevel || !weightClass || selectedDisciplines.length === 0) {
      setError("Please fill in all required fields");
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
          state,
          phone: phone ?? `+91${Date.now()}`,
          email: email ?? null,
          latitude: 12.9716,
          longitude: 77.5946,
          discipline: selectedDisciplines,
          skillLevel,
          weightClass,
          ageYears: parseInt(age) || 0,
          yearsExperience: parseInt(experience) || 0,
          heightCm: heightCm ? parseInt(heightCm) : null,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          totalAmateurFights: parseInt(amateurFights) || 0,
          totalProFights: parseInt(proFights) || 0,
          bio: bio.trim() || null,
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

  const isValid = name && city && state && skillLevel && weightClass && selectedDisciplines.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Complete your{"\n"}fighter profile</Text>
      <Text style={styles.subtitle}>{phone} · {email}</Text>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Basic Info</Text>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput style={styles.input} placeholder="e.g. Arjun Singh" placeholderTextColor="#444" value={name} onChangeText={setName} color="#fff" />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>City *</Text>
          <TextInput style={styles.input} placeholder="Bengaluru" placeholderTextColor="#444" value={city} onChangeText={setCity} color="#fff" />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>State *</Text>
          <TextInput style={styles.input} placeholder="Karnataka" placeholderTextColor="#444" value={state} onChangeText={setState} color="#fff" />
        </View>
      </View>

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

      <Text style={styles.sectionTitle}>Physical Stats</Text>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput style={styles.input} placeholder="175" placeholderTextColor="#444" keyboardType="number-pad" value={heightCm} onChangeText={setHeightCm} color="#fff" />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput style={styles.input} placeholder="70.5" placeholderTextColor="#444" keyboardType="decimal-pad" value={weightKg} onChangeText={handleWeightChange} color="#fff" />
        </View>
      </View>

      {weightKg && !isNaN(parseFloat(weightKg)) && (
        <View style={styles.suggestionBox}>
          <Text style={styles.suggestionText}>
            Suggested weight class: <Text style={styles.suggestionHighlight}>{suggestWeightClass(parseFloat(weightKg)).replace("_", " ")}</Text> ({WEIGHT_CLASS_RANGES[suggestWeightClass(parseFloat(weightKg))]})
          </Text>
        </View>
      )}

      <Text style={styles.label}>Weight Class * (tap to override)</Text>
      <View style={styles.chips}>
        {WEIGHT_CLASSES.map(w => (
          <TouchableOpacity
            key={w}
            style={[styles.chip, weightClass === w && styles.chipActive]}
            onPress={() => setWeightClass(w)}
          >
            <Text style={[styles.chipText, weightClass === w && styles.chipTextActive]}>
              {w.replace("_", " ")}
            </Text>
            <Text style={[styles.chipSub, weightClass === w && styles.chipSubActive]}>
              {WEIGHT_CLASS_RANGES[w]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Fighting Experience</Text>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Amateur Fights</Text>
          <TextInput style={styles.input} placeholder="0" placeholderTextColor="#444" keyboardType="number-pad" value={amateurFights} onChangeText={setAmateurFights} color="#fff" />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Pro Fights</Text>
          <TextInput style={styles.input} placeholder="0" placeholderTextColor="#444" keyboardType="number-pad" value={proFights} onChangeText={setProFights} color="#fff" />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Style & Skills</Text>

      <Text style={styles.label}>Disciplines *</Text>
      <View style={styles.chips}>
        {DISCIPLINES.map(d => (
          <TouchableOpacity key={d} style={[styles.chip, selectedDisciplines.includes(d) && styles.chipActive]} onPress={() => toggleDiscipline(d)}>
            <Text style={[styles.chipText, selectedDisciplines.includes(d) && styles.chipTextActive]}>{d.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Skill Level *</Text>
      <View style={styles.chips}>
        {SKILL_LEVELS.map(s => (
          <TouchableOpacity key={s} style={[styles.chip, skillLevel === s && styles.chipActive]} onPress={() => setSkillLevel(s)}>
            <Text style={[styles.chipText, skillLevel === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>About You</Text>

      <Text style={styles.label}>Bio (optional)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Tell potential sparring partners about your style, goals, preferred training times..."
        placeholderTextColor="#444"
        value={bio}
        onChangeText={setBio}
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
        <Text style={styles.btnText}>
          {loading ? "Creating profile..." : "Start Finding Partners ?"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: "800", color: "#fff", marginBottom: 8, lineHeight: 38 },
  subtitle: { fontSize: 13, color: "#555", marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginTop: 32, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#1a1a1a", paddingBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  textArea: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: "#2a2a2a", minHeight: 100 },
  row: { flexDirection: "row", gap: 12 },
  halfInput: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a", alignItems: "center" },
  chipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  chipText: { color: "#888", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  chipSub: { color: "#555", fontSize: 10, marginTop: 2 },
  chipSubActive: { color: "#ffaaaa" },
  suggestionBox: { backgroundColor: "#22c55e11", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#22c55e33", marginBottom: 8 },
  suggestionText: { color: "#888", fontSize: 13 },
  suggestionHighlight: { color: "#22c55e", fontWeight: "700", textTransform: "capitalize" },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 32 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 16, borderWidth: 1, borderColor: "#e63946" },
});
