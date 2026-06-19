import AsyncStorage from "@react-native-async-storage/async-storage";

const FIGHTER_KEY = "fightfind_fighter_id";

export async function saveSession(fighterId: string) {
  await AsyncStorage.setItem(FIGHTER_KEY, fighterId);
}

export async function getSession(): Promise<string | null> {
  return await AsyncStorage.getItem(FIGHTER_KEY);
}

export async function clearSession() {
  await AsyncStorage.removeItem(FIGHTER_KEY);
}
