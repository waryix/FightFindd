"use client";

import { ApiClient, createApi, type Api } from "@fightfind/api-client";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001").replace(/\/$/, "");

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Cookies (refresh token) must ride along for the web portal. */
const credentialedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, credentials: "include" });

const client = new ApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
  fetchImpl: credentialedFetch,
  refreshAccessToken: async () => {
    try {
      const session = await api.auth.refresh();
      setAccessToken(session.tokens.accessToken);
      return session.tokens.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    }
  },
  onAuthFailure: () => {
    setAccessToken(null);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("ff-auth-failure"));
  },
});

export const api: Api = createApi(client);

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export { API_URL };
