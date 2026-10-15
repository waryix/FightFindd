import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../src/services/config";
import { clearGymSession, getGymEmail, getGymToken, gymAuthHeaders } from "../../src/services/gymAuth";
import { createMonthlyOrder, checkout, verifyPayment } from "../../src/services/gymPayments";

const MONTHLY_FEE = 300;
const DISCIPLINES = ["boxing", "mma", "kickboxing", "muay_thai", "bjj", "wrestling", "mixed"];

export default function GymPortalScreen() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [gym, setGym] = useState<any | null>(null);
  const [needsRegister, setNeedsRegister] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [monthlyFee, setMonthlyFee] = useState("");
  const [hasTrial, setHasTrial] = useState(false);
  const [timings, setTimings] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");

  const fillForm = useCallback((g: any) => {
    setName(g.name ?? "");
    setOwnerName(g.owner_name ?? "");
    setPhone(g.phone ?? "");
    setContactEmail(g.email ?? "");
    setAddress(g.address ?? "");
    setCity(g.city ?? "");
    setStateName(g.state ?? "");
    setPincode(g.pincode ?? "");
    setDisciplines(g.disciplines ?? []);
    setMonthlyFee(g.monthly_fee_inr ? String(g.monthly_fee_inr) : "");
    setHasTrial(Boolean(g.has_trial_class));
    setTimings(g.timings ?? "");
    setDescription(g.description ?? "");
  }, []);

  const loadGym = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/gyms/mine`, { headers: { ...(await gymAuthHeaders()) } });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load your gym.");
        return;
      }
      const mine = data.gym as any | null;
      setGym(mine);
      setNeedsRegister(!mine);
      if (mine) fillForm(mine);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [fillForm]);

  useEffect(() => {
    (async () => {
      const token = await getGymToken();
      if (!token) {
        router.replace("/gym-owner/login");
        return;
      }
      setEmail((await getGymEmail()) ?? "");
      loadGym();
    })();
  }, [loadGym]);

  const handleLogout = async () => {
    await clearGymSession();
    router.replace("/gym-owner/login");
  };

  const toggleDiscipline = (d: string) => {
    setDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleSave = async () => {
    if (!gym) return;
    setSaving(true);
    setSavedMsg("");
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/gyms/${gym.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await gymAuthHeaders()) },
        body: JSON.stringify({
          name: name.trim(),
          owner_name: ownerName.trim(),
          phone: phone.trim(),
          email: contactEmail.trim() || null,
          address: address.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim() || null,
          disciplines,
          monthly_fee_inr: monthlyFee ? parseInt(monthlyFee, 10) : null,
          has_trial_class: hasTrial ? 1 : 0,
          timings: timings.trim() || null,
          description: description.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save changes.");
        return;
      }
      setGym(data.gym);
      setSavedMsg("Profile updated.");
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const handleMonthlyPayment = async () => {
    if (!gym) return;
    setPaying(true);
    setPayMsg("");
    setError("");
    try {
      const { order } = await createMonthlyOrder(gym.id);
      const payment = await checkout(order, `FightFind gym monthly fee (₹${MONTHLY_FEE})`);
      await verifyPayment(order.id, payment.paymentId, payment.signature);
      setPayMsg("Monthly fee paid. Thanks!");
      await loadGym();
    } catch (err: any) {
      setError(err?.message ?? "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e63946" size="large" />
      </View>
    );
  }

  if (needsRegister) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.title}>No gym yet</Text>
        <Text style={styles.subtitle}>{email} isn&apos;t linked to a gym listing yet.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace("/gym-owner/register")}>
          <Text style={styles.btnText}>Register your gym</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.switchText}>Log out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!gym) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorBox}>{error || "Gym not found."}</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleLogout}>
          <Text style={styles.secondaryBtnText}>Log out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const monthlyActive = gym.monthly_status === "active";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>Your portal</Text>
      <Text style={styles.title}>{gym.name}</Text>

      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Signed in as</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{email}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Registration</Text>
            <Text style={[styles.metaValue, { color: gym.registration_paid ? "#22c55e" : "#e63946" }]}>
              {gym.registration_paid ? "Paid" : "Unpaid"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Monthly</Text>
            <Text style={[styles.metaValue, { color: monthlyActive ? "#22c55e" : "#e63946" }]}>
              {monthlyActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
        {payMsg ? <Text style={styles.successBanner}>{payMsg}</Text> : null}
      </View>

      <TouchableOpacity style={[styles.btn, paying && styles.btnDisabled]} onPress={handleMonthlyPayment} disabled={paying}>
        {paying ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Pay ₹{MONTHLY_FEE} monthly fee</Text>}
      </TouchableOpacity>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}
      {savedMsg ? <Text style={styles.successBanner}>{savedMsg}</Text> : null}

      <Text style={styles.label}>Gym name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Owner name</Text>
          <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} />
        </View>
      </View>

      <Text style={styles.label}>Contact email</Text>
      <TextInput style={styles.input} keyboardType="email-address" autoCapitalize="none" value={contactEmail} onChangeText={setContactEmail} />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>State</Text>
          <TextInput style={styles.input} value={stateName} onChangeText={setStateName} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Pincode</Text>
          <TextInput style={styles.input} value={pincode} onChangeText={setPincode} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Monthly fee (INR)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={monthlyFee} onChangeText={(v) => setMonthlyFee(v.replace(/[^0-9]/g, ""))} />
        </View>
      </View>

      <Text style={styles.label}>Disciplines</Text>
      <View style={styles.chips}>
        {DISCIPLINES.map((d) => (
          <TouchableOpacity key={d} style={[styles.chip, disciplines.includes(d) && styles.chipActive]} onPress={() => toggleDiscipline(d)}>
            <Text style={[styles.chipText, disciplines.includes(d) && styles.chipTextActive]}>{d.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Class timings</Text>
      <TextInput style={styles.input} value={timings} onChangeText={setTimings} />

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasTrial((v) => !v)}>
        <View style={[styles.checkbox, hasTrial && styles.checkboxOn]} />
        <Text style={styles.checkboxLabel}>We offer a free trial class</Text>
      </TouchableOpacity>

      <Text style={styles.label}>About your gym</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />

      <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Save changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleLogout}>
        <Text style={styles.secondaryBtnText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 24, paddingTop: 24, paddingBottom: 60 },
  center: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  centerContent: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  eyebrow: { color: "#e63946", fontSize: 12, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: "800", color: "#ffffff", marginTop: 6, marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#888888", textAlign: "center" },
  metaCard: { backgroundColor: "#141414", borderWidth: 1, borderColor: "#2a2a2a", borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 16, gap: 10 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  metaItem: { minWidth: 90 },
  metaLabel: { fontSize: 10, color: "#555555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 14, color: "#cccccc", fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "600", color: "#555555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#ffffff", borderWidth: 1, borderColor: "#2a2a2a" },
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
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 16 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  secondaryBtn: { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  secondaryBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  switchText: { color: "#555555", textAlign: "center", fontSize: 14, marginTop: 8 },
  successBanner: { backgroundColor: "#22c55e11", borderWidth: 1, borderColor: "#22c55e33", color: "#22c55e", borderRadius: 8, padding: 8, fontSize: 13, fontWeight: "700" },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginTop: 12, borderWidth: 1, borderColor: "#e63946", textAlign: "center" },
});
