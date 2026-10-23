import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { saveSession, getSession, saveGuestFlag } from "../src/store/session";
import { API_URL } from "../src/services/config";

export default function LandingScreen() {
  const [guestLoading, setGuestLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const fighterId = await getSession();
      if (fighterId) {
        router.replace("/(tabs)/discover");
        return;
      }
      setChecking(false);
    })();
  }, []);

  const handleGuest = async () => {
    setGuestLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/guest`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) return;
      await saveSession(data.fighter.id, data.access_token);
      await saveGuestFlag(true);
      router.replace("/(tabs)/discover");
    } catch (err) {
      console.error(err);
    } finally {
      setGuestLoading(false);
    }
  };

  const handleGymOwner = () => {
    router.push("/gym-owner");
  };

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#e63946" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
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

        <TouchableOpacity
          style={styles.guestBtn}
          onPress={handleGuest}
          disabled={guestLoading}
        >
          {guestLoading
            ? <ActivityIndicator color="#888" />
            : <Text style={styles.guestBtnText}>Browse as Guest</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.gymOwnerCard} onPress={handleGymOwner}>
          <View style={styles.gymOwnerAccent} />
          <View style={styles.gymOwnerBody}>
            <Text style={styles.gymOwnerTitle}>Own a gym?</Text>
            <Text style={styles.gymOwnerText}>
              If you are a gym owner, register here →
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.hint}>
          For boxers, MMA fighters, kickboxers across India
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
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
  guestBtn: { paddingVertical: 14, alignItems: "center" },
  guestBtnText: { color: "#888888", fontSize: 15, fontWeight: "600" },
  gymOwnerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  gymOwnerAccent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
    backgroundColor: "#e63946",
  },
  gymOwnerBody: { flex: 1 },
  gymOwnerTitle: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  gymOwnerText: { color: "#e63946", fontSize: 13, fontWeight: "600", marginTop: 2 },
  hint: { color: "#555555", textAlign: "center", fontSize: 13, marginTop: 4 },
});
