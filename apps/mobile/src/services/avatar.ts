import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";
import { Platform } from "react-native";

export async function pickAndUploadAvatar(fighterId: string): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Camera roll permission denied");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const fileName = `${fighterId}.jpg`;
  const contentType = "image/jpeg";

  let blob: Blob;

  if (Platform.OS === "web") {
    // On web, uri is already a blob URL or data URL
    const response = await fetch(uri);
    blob = await response.blob();
  } else {
    // On native, fetch the file URI
    const response = await fetch(uri);
    blob = await response.blob();
  }

  const { error } = await supabase.storage
    .from("avatars")
    .upload(fileName, blob, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  // Get clean public URL without any blob reference
  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export function getAvatarUrl(fighterId: string): string {
  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(`${fighterId}.jpg`);
  return data.publicUrl;
}
