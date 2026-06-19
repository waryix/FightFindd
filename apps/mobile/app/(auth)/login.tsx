import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useState } from "react";

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState("");
  const [otpMethod, setOtpMethod] = useState<"phone" | "email">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPhone = /^\d{10}$/.test(identifier);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isValid = isPhone || isEmail;

  const handleContinue = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      // Check if fighter exists
      const endpoint = isPhone
        ? `http://localhost:4000/api/fighters/phone/${encodeURIComponent(`+91${identifier}`)}`
        : `http://localhost:4000/api/fighters/email/${encodeURIComponent(identifier)}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (!data.fighter) {
        setError("No account found. Please sign up first.");
        setLoading(false);
        return;
      }

      // Simulate OTP send
      await new Promise(resolve => setTimeout(resolve, 800));

      router.push({
        pathname: "/(auth)/otp",
        params: {
          phone: isPhone ? `+91${identifier}` : data.fighter.phone,
          email: isEmail ? identifier : data.fighter.email,
          otpMethod: isPhone ? "phone" : "email",
          mode: "login",
          fighterId: data.fighter.id,
        },
      });
    } catch (err) {
      setError("Could not connect to server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome{"\n"}back</Text>
      <Text style={styles.subtitle}>Log in to your FightFind account</Text>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}

      <Text style={styles.label}>Phone number or Email</Text>
      <TextInput
        style={styles.input}
        placeholder="9876543210 or arjun@gmail.com"
        placeholderTextColor="#444"
        keyboardType="email-address"
        autoCapitalize="none"
        value={identifier}
        onChangeText={val => {
          setIdentifier(val);
          setOtpMethod(/^\d/.test(val) ? "phone" : "email");
        }}
        color="#fff"
        autoFocus
      />

      {isValid && (
        <View style={styles.methodHint}>
          <Text style={styles.methodHintText}>
            {isPhone
              ? `We'll send an OTP to +91${identifier}`
              : `We'll send an OTP to ${identifier}`}
          </Text>
        </View>
      )}

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

      <TouchableOpacity onPress={() => router.replace("/(auth)/signup")}>
        <Text style={styles.switchText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", paddingHorizontal: 24, paddingTop: 48 },
  title: { fontSize: 32, fontWeight: "800", color: "#fff", lineHeight: 40, marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#888", marginBottom: 32 },
  label: { fontSize: 12, fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  methodHint: { marginTop: 10, backgroundColor: "#1a1a1a", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  methodHintText: { color: "#888", fontSize: 13 },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 28 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  switchText: { color: "#555", textAlign: "center", fontSize: 14, marginTop: 20 },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: "#e63946" },
});
