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
    quality: 0.7,
  });

  if (result.canceled || !result.assets[0]) return null;

  // Local dev: use the picked asset URI directly (no remote storage).
  return result.assets[0].uri;
}

export function getAvatarUrl(_fighterId: string): string {
  return "";
}
