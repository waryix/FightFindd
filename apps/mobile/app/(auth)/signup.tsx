import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useState } from "react";

export default function SignUpScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpMethod, setOtpMethod] = useState<"phone" | "email" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValidPhone = phone.length === 10;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = name.trim().length > 0 && isValidPhone && isValidEmail && otpMethod !== null;

  const handleContinue = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      // Simulate OTP send — replace with MSG91 or email OTP later
      await new Promise(resolve => setTimeout(resolve, 800));

      router.push({
        pathname: "/(auth)/otp",
        params: {
          phone: `+91${phone}`,
          email,
          name,
          otpMethod,
          mode: "signup",
        },
      });
    } catch (err) {
      setError("Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create your{"\n"}account</Text>
      <Text style={styles.subtitle}>Join FightFind and start training</Text>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Arjun Singh"
        placeholderTextColor="#444"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        color="#fff"
      />

      <Text style={styles.label}>Mobile Number</Text>
      <View style={styles.phoneRow}>
        <View style={styles.countryCode}>
          <Text style={styles.countryCodeText}>???? +91</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          placeholder="98765 43210"
          placeholderTextColor="#444"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
          color="#fff"
        />
      </View>

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. arjun@gmail.com"
        placeholderTextColor="#444"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        color="#fff"
      />

      <Text style={styles.label}>Verify via</Text>
      <View style={styles.methodRow}>
        <TouchableOpacity
          style={[styles.methodBtn, otpMethod === "phone" && styles.methodBtnActive]}
          onPress={() => setOtpMethod("phone")}
        >
          <Text style={[styles.methodBtnText, otpMethod === "phone" && styles.methodBtnTextActive]}>
            SMS to +91{phone || "XXXXXXXXXX"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.methodBtn, otpMethod === "email" && styles.methodBtnActive]}
          onPress={() => setOtpMethod("email")}
        >
          <Text style={[styles.methodBtnText, otpMethod === "email" && styles.methodBtnTextActive]}>
            Email to {email || "your@email.com"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.btn, !isValid && styles.btnDisabled]}
        onPress={handleContinue}
        disabled={!isValid || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Send OTP</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
        <Text style={styles.switchText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 32, fontWeight: "800", color: "#fff", lineHeight: 40, marginBottom: 8, marginTop: 16 },
  subtitle: { fontSize: 15, color: "#888", marginBottom: 32 },
  label: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  phoneRow: { flexDirection: "row", gap: 10 },
  countryCode: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  countryCodeText: { color: "#fff", fontSize: 15 },
  phoneInput: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  methodRow: { gap: 10 },
  methodBtn: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  methodBtnActive: { borderColor: "#e63946", backgroundColor: "#e6394611" },
  methodBtnText: { color: "#666", fontSize: 14 },
  methodBtnTextActive: { color: "#e63946", fontWeight: "600" },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 28 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  switchText: { color: "#555", textAlign: "center", fontSize: 14, marginTop: 20 },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: "#e63946" },
});
