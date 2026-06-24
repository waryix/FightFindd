import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

export async function pickAndUploadAvatar(fighterId: string): Promise<string | null> {
  // Request permissions
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Camera roll permission denied");
  }

  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${fighterId}.${ext}`;
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  // Convert to blob
  const response = await fetch(uri);
  const blob = await response.blob();

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from("avatars")
    .upload(fileName, blob, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  // Get public URL
  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export function getAvatarUrl(fighterId: string, ext = "jpg"): string {
  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(`${fighterId}.${ext}`);
  return data.publicUrl;
}
