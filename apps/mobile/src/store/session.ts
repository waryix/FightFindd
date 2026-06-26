import AsyncStorage from "@react-native-async-storage/async-storage";

const FIGHTER_KEY = "fightfind_fighter_id";
const TOKEN_KEY = "fightfind_token";

export async function saveSession(fighterId: string, token?: string) {
  await AsyncStorage.setItem(FIGHTER_KEY, fighterId);
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getSession(): Promise<string | null> {
  return await AsyncStorage.getItem(FIGHTER_KEY);
}

export async function getToken(): Promise<string | null> {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearSession() {
  await AsyncStorage.removeItem(FIGHTER_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
}
