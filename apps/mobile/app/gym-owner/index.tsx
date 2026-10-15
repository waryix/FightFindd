import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { getGymToken } from "../../src/services/gymAuth";

export default function GymOwnerEntry() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getGymToken();
      if (token) {
        router.replace("/gym-owner/portal");
        return;
      }
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e63946" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>GYM OWNERS</Text>
        </View>
        <Text style={styles.title}>List your gym on FightFind</Text>
        <Text style={styles.subtitle}>
          Register your combat-sports gym and get discovered by fighters across India.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/gym-owner/login?next=register")}
        >
          <Text style={styles.primaryBtnText}>Register your gym</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/gym-owner/login")}
        >
          <Text style={styles.secondaryBtnText}>Gym owner login</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>₹1,000 one-time · then ₹300/month</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40, justifyContent: "space-between" },
  center: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  hero: { gap: 14, marginTop: 40 },
  badge: { alignSelf: "flex-start", backgroundColor: "#e6394622", borderWidth: 1, borderColor: "#e6394655", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: "#e63946", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 32, fontWeight: "900", color: "#ffffff", lineHeight: 38 },
  subtitle: { fontSize: 16, color: "#888888", lineHeight: 24 },
  actions: { gap: 12 },
  primaryBtn: { backgroundColor: "#e63946", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  primaryBtnText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  secondaryBtn: { backgroundColor: "#1a1a1a", paddingVertical: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  secondaryBtnText: { color: "#ffffff", fontSize: 17, fontWeight: "600" },
  hint: { color: "#555555", textAlign: "center", fontSize: 13, marginTop: 4 },
});
