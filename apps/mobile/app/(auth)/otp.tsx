import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useRef } from "react";
import { saveSession } from "../../src/store/session";

export default function OtpScreen() {
  const { phone, email, name, otpMethod, mode, fighterId } = useLocalSearchParams<{
    phone: string;
    email: string;
    name: string;
    otpMethod: string;
    mode: "login" | "signup";
    fighterId: string;
  }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<any[]>([]);

  const handleChange = (val: string, idx: number) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const sentTo = otpMethod === "phone" ? phone : email;

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Simulate OTP verification — replace with real verification later
      await new Promise(resolve => setTimeout(resolve, 800));

      if (mode === "login") {
        // Login — fighter already exists, fighterId passed from login screen
        await saveSession(fighterId);
        router.replace("/(tabs)/discover");
      } else {
        // Signup — go to profile setup with all details
        router.replace({
          pathname: "/(auth)/profile-setup",
          params: { phone, email, name },
        });
      }
    } catch (err) {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        Sent via {otpMethod === "phone" ? "SMS" : "email"} to{"\n"}
        <Text style={styles.sentTo}>{sentTo}</Text>
      </Text>

      <View style={styles.otpRow}>
        {otp.map((digit, idx) => (
          <TextInput
            key={idx}
            ref={ref => { inputs.current[idx] = ref; }}
            style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
            value={digit}
            onChangeText={val => handleChange(val.slice(-1), idx)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            autoFocus={idx === 0}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, otp.join("").length !== 6 && styles.btnDisabled]}
        onPress={handleVerify}
        disabled={loading || otp.join("").length !== 6}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>
              {mode === "login" ? "Log In" : "Verify & Continue"}
            </Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.resend}>Resend OTP</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        For testing, enter any 6 digits
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", paddingHorizontal: 24, paddingTop: 48 },
  title: { fontSize: 32, fontWeight: "800", color: "#ffffff", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#888888", marginBottom: 40, lineHeight: 22 },
  sentTo: { color: "#fff", fontWeight: "600" },
  otpRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  otpInput: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 18, fontSize: 24, fontWeight: "700", color: "#ffffff", borderWidth: 1, borderColor: "#2a2a2a" },
  otpInputFilled: { borderColor: "#e63946" },
  error: { color: "#e63946", fontSize: 13, marginBottom: 12 },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  resend: { color: "#e63946", textAlign: "center", fontSize: 15, marginBottom: 16 },
  hint: { color: "#333", textAlign: "center", fontSize: 12, marginTop: 8 },
});
