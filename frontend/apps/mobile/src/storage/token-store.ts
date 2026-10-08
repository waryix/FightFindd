import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "ff_access_token";
const REFRESH_KEY = "ff_refresh_token";
const USER_KEY = "ff_user";

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

let memory: StoredTokens = { accessToken: null, refreshToken: null };
const listeners = new Set<(tokens: StoredTokens) => void>();

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch {
      // Ignore storage failures on web (private mode).
    }
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

export function getTokensSync(): StoredTokens {
  return memory;
}

export function subscribeTokens(listener: (tokens: StoredTokens) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener({ ...memory });
}

export async function loadTokens(): Promise<StoredTokens> {
  const [accessToken, refreshToken] = await Promise.all([getItem(ACCESS_KEY), getItem(REFRESH_KEY)]);
  memory = { accessToken, refreshToken };
  notify();
  return { ...memory };
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  memory = { ...tokens };
  await Promise.all([setItem(ACCESS_KEY, tokens.accessToken), setItem(REFRESH_KEY, tokens.refreshToken)]);
  notify();
}

export async function clearTokens(): Promise<void> {
  memory = { accessToken: null, refreshToken: null };
  await Promise.all([setItem(ACCESS_KEY, null), setItem(REFRESH_KEY, null), setItem(USER_KEY, null)]);
  notify();
}

export async function saveCachedUser(user: unknown): Promise<void> {
  await setItem(USER_KEY, user ? JSON.stringify(user) : null);
}

export async function loadCachedUser<T>(): Promise<T | null> {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
