import { ApiClient, createApi, type Api } from "@fightfind/api-client";
import { API_URL } from "../config";
import { clearTokens, getTokensSync, loadTokens, saveTokens } from "../storage/token-store";

const authFailureListeners = new Set<() => void>();

export function onAuthFailure(listener: () => void): () => void {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

const client = new ApiClient({
  baseUrl: API_URL,
  getAccessToken: () => getTokensSync().accessToken,
  refreshAccessToken: async () => {
    const { refreshToken } = getTokensSync();
    if (!refreshToken) return null;
    try {
      const session = await api.auth.refresh(refreshToken);
      await saveTokens({
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken ?? refreshToken,
      });
      return session.tokens.accessToken;
    } catch {
      await clearTokens();
      for (const listener of authFailureListeners) listener();
      return null;
    }
  },
  onAuthFailure: () => {
    void clearTokens();
    for (const listener of authFailureListeners) listener();
  },
});

export const api: Api = createApi(client);

export async function bootstrapTokens(): Promise<void> {
  await loadTokens();
}

export function isAuthenticated(): boolean {
  return Boolean(getTokensSync().accessToken);
}
