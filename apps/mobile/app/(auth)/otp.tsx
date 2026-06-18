import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useRef } from "react";

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<any[]>([]);

  const handleChange = (val: string, idx: number) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // MSG91 OTP verification goes here
      await new Promise(resolve => setTimeout(resolve, 1000));
      // After verify, go to profile setup
      router.replace("/(auth)/profile-setup");
    } catch (err) {
      setError("Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        Sent to {phone}
      </Text>

      <View style={styles.otpRow}>
        {otp.map((digit, idx) => (
          <TextInput
            key={idx}
            ref={ref => { inputs.current[idx] = ref; }}
            style={styles.otpInput}
            value={digit}
            onChangeText={val => handleChange(val.slice(-1), idx)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Verify & Continue</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.resend}>Resend OTP</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#888888",
    marginBottom: 40,
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  otpInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 18,
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  error: {
    color: "#e63946",
    fontSize: 13,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#e63946",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  btnText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  resend: {
    color: "#e63946",
    textAlign: "center",
    fontSize: 15,
  },
});
