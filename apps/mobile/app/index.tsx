import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>??</Text>
        <Text style={styles.title}>FightFind</Text>
        <Text style={styles.tagline}>Find sparring partners.{"\n"}Discover gyms. Train harder.</Text>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/(auth)/phone")}
        >
          <Text style={styles.primaryBtnText}>Get Started</Text>
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
  hero: {
    alignItems: "center",
    gap: 16,
  },
  emoji: {
    fontSize: 72,
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: "#888888",
    textAlign: "center",
    lineHeight: 28,
  },
  bottom: {
    gap: 16,
  },
  primaryBtn: {
    backgroundColor: "#e63946",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  hint: {
    color: "#555555",
    textAlign: "center",
    fontSize: 13,
  },
});
