import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>FF</Text>
        </View>
        <Text style={styles.title}>FightFind</Text>
        <Text style={styles.tagline}>Find sparring partners.{"\n"}Discover gyms. Train harder.</Text>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.secondaryBtnText}>Log In</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          For boxers, MMA fighters, kickboxers across India
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingTop: 100,
    paddingBottom: 60,
  },
  hero: { alignItems: "center", gap: 16 },
  logoBox: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: "#e63946",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: { fontSize: 36, fontWeight: "900", color: "#ffffff", letterSpacing: -1 },
  title: { fontSize: 48, fontWeight: "900", color: "#ffffff", letterSpacing: -1 },
  tagline: { fontSize: 18, color: "#888888", textAlign: "center", lineHeight: 28 },
  bottom: { gap: 12 },
  primaryBtn: {
    backgroundColor: "#e63946",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  secondaryBtnText: { color: "#ffffff", fontSize: 18, fontWeight: "600" },
  hint: { color: "#555555", textAlign: "center", fontSize: 13, marginTop: 4 },
});
