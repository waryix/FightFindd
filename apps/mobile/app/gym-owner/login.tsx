import { Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { supabase } from "../../src/services/supabase";
import { saveGymSession } from "../../src/services/gymAuth";

export default function GymOwnerLogin() {
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSend = async () => {
    if (!isValidEmail) return;
    setLoading(true);
    setError("");
    const { error: otpError } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStage("otp");
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Enter the complete 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp,
    });
    if (verifyError || !data.session?.access_token) {
      setLoading(false);
      setError(verifyError?.message ?? "Invalid code. Please try again.");
      return;
    }
    await saveGymSession(data.session.access_token, email.trim().toLowerCase());
    setLoading(false);
    if (next === "register") router.replace("/gym-owner/register");
    else router.replace("/gym-owner/portal");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Gym owner login</Text>
        <Text style={styles.subtitle}>We&apos;ll email you a one-time code. No password needed.</Text>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="gym@example.com"
          placeholderTextColor="#444"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={stage === "email"}
          value={email}
          onChangeText={setEmail}
        />

        {stage === "otp" ? (
          <>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor="#444"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ""))}
            />
          </>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, (stage === "email" ? !isValidEmail : otp.length !== 6) && styles.btnDisabled]}
          onPress={stage === "email" ? handleSend : handleVerify}
          disabled={loading || (stage === "email" ? !isValidEmail : otp.length !== 6)}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.btnText}>{stage === "email" ? "Send login code" : "Verify & continue"}</Text>
          )}
        </TouchableOpacity>

        {stage === "otp" ? (
          <TouchableOpacity onPress={() => { setStage("email"); setOtp(""); setError(""); }}>
            <Text style={styles.switchText}>Use a different email</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 24, paddingTop: 40, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: "800", color: "#ffffff", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#888888", marginBottom: 24, lineHeight: 22 },
  label: { fontSize: 12, fontWeight: "600", color: "#555555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#ffffff", borderWidth: 1, borderColor: "#2a2a2a" },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 28 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  switchText: { color: "#555555", textAlign: "center", fontSize: 14, marginTop: 20 },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: "#e63946" },
});
