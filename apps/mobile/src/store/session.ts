import AsyncStorage from "@react-native-async-storage/async-storage";

const FIGHTER_KEY = "fightfind_fighter_id";
const TOKEN_KEY = "fightfind_token";
const GUEST_KEY = "fightfind_is_guest";

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

export async function saveGuestFlag(isGuest: boolean) {
  await AsyncStorage.setItem(GUEST_KEY, isGuest ? "1" : "0");
}

export async function isGuestSession(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_KEY)) === "1";
}

export async function clearSession() {
  await AsyncStorage.removeItem(FIGHTER_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(GUEST_KEY);
}
