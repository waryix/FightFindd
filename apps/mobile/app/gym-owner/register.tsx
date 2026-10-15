import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { API_URL } from "../../src/services/config";
import { getGymEmail, getGymToken, gymAuthHeaders } from "../../src/services/gymAuth";
import { createGymOrder, checkout, verifyPayment } from "../../src/services/gymPayments";

const REGISTRATION_FEE = 1000;
const DISCIPLINES = ["boxing", "mma", "kickboxing", "muay_thai", "bjj", "wrestling", "mixed"];

export default function GymRegisterScreen() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [monthlyFee, setMonthlyFee] = useState("");
  const [hasTrial, setHasTrial] = useState(false);
  const [timings, setTimings] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<"idle" | "paying" | "creating">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const token = await getGymToken();
      if (!token) {
        router.replace("/gym-owner/login?next=register");
        return;
      }
      setEmail((await getGymEmail()) ?? "");
    })();
  }, []);

  const toggleDiscipline = (d: string) => {
    setDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const isValid =
    name.trim() && ownerName.trim() && phone.trim() && address.trim() && city.trim() && stateName.trim() && disciplines.length > 0;

  const loading = step !== "idle";

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Please fill in all required fields and pick at least one discipline.");
      return;
    }
    setError("");
    try {
      setStep("paying");
      const { order } = await createGymOrder();
      const payment = await checkout(order, `FightFind gym registration (₹${REGISTRATION_FEE})`);
      await verifyPayment(order.id, payment.paymentId, payment.signature);

      setStep("creating");
      const response = await fetch(`${API_URL}/api/gyms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await gymAuthHeaders()) },
        body: JSON.stringify({
          name: name.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          address: address.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim() || null,
          disciplines,
          monthlyFeeInr: monthlyFee ? parseInt(monthlyFee, 10) : null,
          hasTrialClass: hasTrial,
          timings: timings.trim() || null,
          description: description.trim() || null,
          payment_order_id: order.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not register your gym. Please try again.");
        return;
      }
      router.replace("/gym-owner/portal");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setStep("idle");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Get your gym on FightFind</Text>
      <Text style={styles.subtitle}>
        One-time registration fee of ₹{REGISTRATION_FEE}, then ₹300/month.
      </Text>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}

      <Text style={styles.label}>Gym name *</Text>
      <TextInput style={styles.input} placeholder="e.g. Knockout Boxing Club" placeholderTextColor="#444" value={name} onChangeText={setName} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Owner name *</Text>
          <TextInput style={styles.input} placeholder="Arjun Singh" placeholderTextColor="#444" value={ownerName} onChangeText={setOwnerName} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Phone *</Text>
          <TextInput style={styles.input} placeholder="+91 98765 43210" placeholderTextColor="#444" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        </View>
      </View>

      <Text style={styles.label}>Email (login)</Text>
      <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />

      <Text style={styles.label}>Address *</Text>
      <TextInput style={styles.input} placeholder="Street, area" placeholderTextColor="#444" value={address} onChangeText={setAddress} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>City *</Text>
          <TextInput style={styles.input} placeholder="Bengaluru" placeholderTextColor="#444" value={city} onChangeText={setCity} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>State *</Text>
          <TextInput style={styles.input} placeholder="Karnataka" placeholderTextColor="#444" value={stateName} onChangeText={setStateName} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Pincode</Text>
          <TextInput style={styles.input} placeholder="560038" placeholderTextColor="#444" keyboardType="number-pad" value={pincode} onChangeText={setPincode} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Monthly fee (INR)</Text>
          <TextInput style={styles.input} placeholder="3500" placeholderTextColor="#444" keyboardType="number-pad" value={monthlyFee} onChangeText={(v) => setMonthlyFee(v.replace(/[^0-9]/g, ""))} />
        </View>
      </View>

      <Text style={styles.label}>Disciplines *</Text>
      <View style={styles.chips}>
        {DISCIPLINES.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, disciplines.includes(d) && styles.chipActive]}
            onPress={() => toggleDiscipline(d)}
          >
            <Text style={[styles.chipText, disciplines.includes(d) && styles.chipTextActive]}>{d.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Class timings</Text>
      <TextInput style={styles.input} placeholder="Mon–Sat 6–9am, 5–9pm" placeholderTextColor="#444" value={timings} onChangeText={setTimings} />

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasTrial((v) => !v)}>
        <View style={[styles.checkbox, hasTrial && styles.checkboxOn]} />
        <Text style={styles.checkboxLabel}>We offer a free trial class</Text>
      </TouchableOpacity>

      <Text style={styles.label}>About your gym</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Tell fighters about your coaches, facilities and training style…"
        placeholderTextColor="#444"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />

      <TouchableOpacity
        style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.btnText}>Pay ₹{REGISTRATION_FEE} &amp; register</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        {step === "paying" ? "Processing payment…" : step === "creating" ? "Creating your listing…" : "* required"}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 24, paddingTop: 24, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: "800", color: "#ffffff", marginBottom: 6 },
  subtitle: { fontSize: 15, color: "#888888", marginBottom: 12, lineHeight: 22 },
  label: { fontSize: 12, fontWeight: "600", color: "#555555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#ffffff", borderWidth: 1, borderColor: "#2a2a2a" },
  inputDisabled: { color: "#777777" },
  textArea: { minHeight: 100 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipActive: { backgroundColor: "#e63946", borderColor: "#e63946" },
  chipText: { color: "#888888", fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
  chipTextActive: { color: "#ffffff" },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: "#2a2a2a", backgroundColor: "#1a1a1a" },
  checkboxOn: { backgroundColor: "#e63946", borderColor: "#e63946" },
  checkboxLabel: { color: "#dddddd", fontSize: 15 },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 28 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  hint: { color: "#555555", textAlign: "center", fontSize: 13, marginTop: 12 },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: "#e63946" },
});
