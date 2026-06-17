import { View, Text, StyleSheet } from "react-native";
import type { Fighter } from "@repo/types/fighter";
import { compatibilityScore } from "@repo/utils/matching";

const mockFighter: Fighter = {
  id: "1",
  name: "Arjun Singh",
  phone: "+919876543210",
  city: "Bengaluru",
  state: "Karnataka",
  latitude: 12.9716,
  longitude: 77.5946,
  discipline: ["boxing"],
  skillLevel: "intermediate",
  weightClass: "welterweight",
  ageYears: 24,
  yearsExperience: 3,
  isVerified: true,
  createdAt: new Date().toISOString(),
};

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FightFind</Text>
      <Text style={styles.subtitle}>Find your sparring partner</Text>
      <Text style={styles.debug}>
        Loaded fighter: {mockFighter.name} — {mockFighter.city}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 16,
    color: "#888888",
    marginTop: 8,
  },
  debug: {
    fontSize: 12,
    color: "#444444",
    marginTop: 24,
  },
});
