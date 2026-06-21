import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { supabase } from "../../src/services/supabase";

export default function SignUpScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValidPhone = phone.length === 10;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = name.trim().length > 0 && isValidPhone && isValidEmail;

  const handleContinue = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      console.log("Sending OTP to:", email);

      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      console.log("Supabase response:", JSON.stringify(data));
      console.log("Supabase error:", JSON.stringify(otpError));

      if (otpError) {
        setError(otpError.message || JSON.stringify(otpError));
        return;
      }

      router.push({
        pathname: "/(auth)/otp",
        params: {
          phone: `+91${phone}`,
          email,
          name,
          otpMethod: "email",
          mode: "signup",
        },
      });
    } catch (err: any) {
      console.log("Caught error:", err);
      setError(err.message || "Something went wrong. Try again.");
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
          <Text style={styles.countryCodeText}>+91</Text>
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

      {isValidEmail && (
        <View style={styles.otpNote}>
          <Text style={styles.otpNoteText}>
            A 6-digit OTP will be sent to {email}
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
          : <Text style={styles.btnText}>Send OTP to Email</Text>
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
  countryCode: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, justifyContent: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  countryCodeText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  phoneInput: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  otpNote: { marginTop: 16, backgroundColor: "#1a1a1a", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  otpNoteText: { color: "#888", fontSize: 13 },
  btn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 24 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  switchText: { color: "#555", textAlign: "center", fontSize: 14, marginTop: 20 },
  errorBox: { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, color: "#e63946", fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: "#e63946" },
});
