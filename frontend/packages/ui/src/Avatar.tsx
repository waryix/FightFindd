import { Image, StyleSheet, Text, View } from "react-native";
import { theme } from "@fightfind/config";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  accent?: string;
}

export function Avatar({ name, avatarUrl, size = 52, accent = theme.colors.primary }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const radius = size / 2;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        accessibilityLabel={`${name} profile photo`}
      />
    );
  }

  return (
    <View
      style={[styles.placeholder, { width: size, height: size, borderRadius: radius, backgroundColor: accent }]}
      accessibilityLabel={`${name} initials`}
    >
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontWeight: "800" },
});
