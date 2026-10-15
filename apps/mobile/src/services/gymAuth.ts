import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "fightfind_gym_token";
const EMAIL_KEY = "fightfind_gym_email";

export async function saveGymSession(token: string, email: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(EMAIL_KEY, email);
}

export async function getGymToken(): Promise<string | null> {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function getGymEmail(): Promise<string | null> {
  return await AsyncStorage.getItem(EMAIL_KEY);
}

export async function clearGymSession() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(EMAIL_KEY);
}

export async function gymAuthHeaders(): Promise<Record<string, string>> {
  const token = await getGymToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
