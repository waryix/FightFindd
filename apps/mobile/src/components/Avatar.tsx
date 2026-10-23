import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { pickAndUploadAvatar } from "../services/avatar";
import { API_URL } from "../services/config";
import { getSession } from "../store/session";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  editable?: boolean;
  onUploaded?: (url: string) => void;
}

export default function Avatar({ name, avatarUrl, size = 52, editable = false, onUploaded }: AvatarProps) {
  const [uploading, setUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(avatarUrl);

  useEffect(() => {
    setCurrentUrl(avatarUrl ?? null);
  }, [avatarUrl]);

  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const fontSize = size * 0.34;
  const borderRadius = size / 2;

  const handlePress = async () => {
    if (!editable) return;
    setUploading(true);
    try {
      const fighterId = await getSession();
      if (!fighterId) return;

      const url = await pickAndUploadAvatar(fighterId);
      if (!url) return;

      // Save avatar URL to fighter profile
      await fetch(`${API_URL}/api/fighters/${fighterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });

      setCurrentUrl(url);
      onUploaded?.(url);
    } catch (err: any) {
      console.error("Avatar upload failed:", err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!editable || uploading}
      activeOpacity={editable ? 0.7 : 1}
    >
      <View style={[styles.container, { width: size, height: size, borderRadius }]}>
        {currentUrl ? (
          <Image
            source={{ uri: currentUrl }}
            style={[styles.image, { width: size, height: size, borderRadius }]}
          />
        ) : (
          <View style={[styles.placeholder, { width: size, height: size, borderRadius }]}>
            <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
          </View>
        )}
        {uploading && (
          <View style={[styles.uploadingOverlay, { width: size, height: size, borderRadius }]}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
        {editable && !uploading && (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>+</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative" },
  image: { resizeMode: "cover" },
  placeholder: { backgroundColor: "#e63946", alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontWeight: "800" },
  uploadingOverlay: { position: "absolute", backgroundColor: "#00000088", alignItems: "center", justifyContent: "center" },
  editBadge: { position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: "#e63946", borderWidth: 2, borderColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  editBadgeText: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 16 },
});
