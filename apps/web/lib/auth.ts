import { API_URL } from "./api";

const TOKEN_KEY = "fightfind_gym_token";
const EMAIL_KEY = "fightfind_gym_email";

export interface Session {
  access_token: string;
  user: { id: string | null; email: string };
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  try {
    localStorage.setItem(TOKEN_KEY, session.access_token);
    localStorage.setItem(EMAIL_KEY, session.user.email);
  } catch {
    /* ignore storage errors */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function post<T>(path: string, body: unknown, auth = false): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? authHeaders() : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export function sendOtp(email: string): Promise<{ success: boolean; devOtp?: string }> {
  return post("/api/auth/otp/send-email", { email });
}

export function verifyOtp(email: string, otp: string): Promise<Session> {
  return post("/api/auth/otp/verify-email", { email, otp });
}
