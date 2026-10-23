import * as ImagePicker from "expo-image-picker";

export async function pickAndUploadAvatar(_fighterId: string): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Camera roll permission denied");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
    base64: true,
  });

  if (result.canceled || !result.assets[0]) return null;

  // Persist as a data URI so the avatar survives a refresh/reload
  // (blob:/file: URIs are not stable across sessions).
  const asset = result.assets[0];
  if (asset.base64) {
    const mime = asset.mimeType ?? "image/jpeg";
    return `data:${mime};base64,${asset.base64}`;
  }
  return asset.uri;
}

export function getAvatarUrl(_fighterId: string): string {
  return "";
}
