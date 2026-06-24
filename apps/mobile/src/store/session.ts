import { Platform } from "react-native";

const FIGHTER_KEY = "fightfind_fighter_id";

export async function saveSession(fighterId: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(FIGHTER_KEY, fighterId);
    return;
  }
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  await AsyncStorage.setItem(FIGHTER_KEY, fighterId);
}

export async function getSession(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(FIGHTER_KEY);
  }
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return await AsyncStorage.getItem(FIGHTER_KEY);
}

export async function clearSession() {
  if (Platform.OS === "web") {
    localStorage.removeItem(FIGHTER_KEY);
    return;
  }
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  await AsyncStorage.removeItem(FIGHTER_KEY);
}
