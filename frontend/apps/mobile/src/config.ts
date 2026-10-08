import { Platform } from "react-native";
import Constants from "expo-constants";

function inferDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    null;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

export function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const fallbackDevHost = Platform.OS !== "web" ? inferDevHost() : null;
  if (configured && configured.includes("localhost") && fallbackDevHost) {
    return configured.replace("localhost", fallbackDevHost);
  }
  if (configured) return configured.replace(/\/$/, "");
  if (fallbackDevHost) return `http://${fallbackDevHost}:4001`;
  return "http://localhost:4001";
}

export const API_URL = resolveApiUrl();

export const analyticsEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== "false";

export const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

export function wsUrl(): string {
  return `${API_URL.replace(/^http/, "ws")}/api/v1/ws`;
}
