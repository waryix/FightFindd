import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { supabase } from "../../src/services/supabase";
import { API_URL } from "../../src/services/config";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleContinue = async () => {
    if (!isValidEmail) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/fighters/email/${encodeURIComponent(email)}`);
      const data = await response.json();
      if (!data.fighter) { setError("No account found with this email. Please sign up first."); setLoading(false); return; }

      const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (otpError) { setError(otpError.message); return; }

      router.push({
        pathname: "/(auth)/otp",
        params: { email, phone: data.fighter.phone, otpMethod: "email", mode: "login", fighterId: data.fighter.id },
      });
    } catch { setError("Could not connect to server. Try again."); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome{"\n"}back</Text>
      <Text style={styles.subtitle}>Log in with your email address</Text>
      {error ? <Text style={styles.errorBox}>{error}</Text> : null}
      <Text style={styles.label}>Email Address</Text>
      <TextInput style={styles.input} placeholder="arjun@gmail.com" placeholderTextColor="#444" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} color="#fff" autoFocus />
      {isValidEmail && <View style={styles.methodHint}><Text style={styles.methodHintText}>A 6-digit OTP will be sent to {email}</Text></View>}
      <TouchableOpacity style={[styles.btn, !isValidEmail && styles.btnDisabled]} onPress={handleContinue} disabled={!isValidEmail || loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
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
