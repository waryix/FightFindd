import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { saveSession } from "../../src/store/session";
import { supabase } from "../../src/services/supabase";
import { OtpInput } from "../../src/components/OtpInput";

export default function OtpScreen() {
  const { phone, email, name, mode, fighterId } = useLocalSearchParams<{
    phone: string;
    email: string;
    name: string;
    mode: "login" | "signup";
    fighterId: string;
  }>();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    const code = otp;
    if (code.length !== 6) { setError("Enter the complete 6-digit OTP"); return; }

    setLoading(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (verifyError) { setError(verifyError.message); return; }

      const token = data.session?.access_token;

      if (mode === "login") {
        await saveSession(fighterId, token);
        router.replace("/(tabs)/discover");
      } else {
        router.replace({
          pathname: "/(auth)/profile-setup",
          params: { phone, email, name, token: token ?? "" },
        });
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setOtp("");
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: mode === "signup" },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        Sent to your email{"\n"}
        <Text style={styles.sentTo}>{email}</Text>
      </Text>

      <OtpInput value={otp} onChange={setOtp} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, otp.length !== 6 && styles.btnDisabled]}
        onPress={handleVerify}
        disabled={loading || otp.length !== 6}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{mode === "login" ? "Log In" : "Verify & Continue"}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResend}>
        <Text style={styles.resend}>Resend OTP</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Check your spam folder if you don't see it</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", paddingHorizontal: 24, paddingTop: 48 },
  title: { fontSize: 32, fontWeight: "800", color: "#ffffff", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#888888", marginBottom: 40, lineHeight: 22 },
  sentTo: { color: "#fff", fontWeight: "600" },
  error: { color: "#e63946", fontSize: 13, marginBottom: 12 },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  resend: { color: "#e63946", textAlign: "center", fontSize: 15, marginBottom: 12 },
  hint: { color: "#333", textAlign: "center", fontSize: 12 },
});
