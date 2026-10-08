import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

export interface UploadFile {
  uri?: string;
  file?: Blob;
  name: string;
  type: string;
}

export interface PickImageResult {
  canceled: boolean;
  upload?: UploadFile;
}

/**
 * Picks an image and returns it in the right shape for the API client:
 * a real Blob on web, or a React Native file descriptor ({ uri }) on device.
 */
export async function pickImage(options?: { aspect?: [number, number] }): Promise<PickImageResult> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Photo permission is required to set an image.");
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: options?.aspect ?? [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return { canceled: true };

  const asset = result.assets[0];
  const name = asset.fileName ?? "upload.jpg";
  const type = asset.mimeType ?? "image/jpeg";

  if (Platform.OS === "web") {
    const webFile = (asset as { file?: File }).file;
    const file = webFile ?? (await (await fetch(asset.uri)).blob());
    return { canceled: false, upload: { file, name, type } };
  }

  return { canceled: false, upload: { uri: asset.uri, name, type } };
}
