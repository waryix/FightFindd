import { View, Text, StyleSheet } from "react-native";
export default function GymsScreen() {
  return <View style={styles.container}><Text style={styles.text}>Gyms — coming next</Text></View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  text: { color: "#888", fontSize: 16 },
});
