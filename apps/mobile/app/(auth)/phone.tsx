import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useState } from "react";

export default function PhoneScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // OTP integration with MSG91 goes here
      // For now we simulate a successful OTP send
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push({
        pathname: "/(auth)/otp",
        params: { phone: `+91${phone}` },
      });
    } catch {
      setError("Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.title}>Enter your{"\n"}mobile number</Text>
        <Text style={styles.subtitle}>
          We'll send you a verification code
        </Text>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.countryCode}>
          <Text style={styles.countryCodeText}>???? +91</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="98765 43210"
          placeholderTextColor="#444"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
          autoFocus
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, phone.length !== 10 && styles.btnDisabled]}
        onPress={handleSendOtp}
        disabled={phone.length !== 10 || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Send OTP</Text>
        }
      </TouchableOpacity>

      <Text style={styles.terms}>
        By continuing, you agree to FightFind's Terms of Service and Privacy Policy
      </Text>
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
  top: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#888888",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  countryCode: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  countryCodeText: {
    color: "#ffffff",
    fontSize: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 20,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    letterSpacing: 2,
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
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  terms: {
    color: "#444444",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
  },
});
