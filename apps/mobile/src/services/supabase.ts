import { API_URL } from "./config";
import { getToken } from "../store/session";

interface AuthResult<T> {
  data: T;
  error: { message: string } | null;
}

interface OtpData {
  session: { access_token: string } | null;
  user?: { id: string | null; email: string };
}

function post(path: string, body: unknown) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const auth = {
  async signInWithOtp({ email }: { email: string; options?: { shouldCreateUser?: boolean } }): Promise<AuthResult<unknown>> {
    try {
      const res = await post("/api/auth/otp/send-email", { email });
      const json = await res.json();
      if (!res.ok) return { data: null, error: { message: json.error ?? "Could not send OTP" } };
      return { data: json, error: null };
    } catch {
      return { data: null, error: { message: "Could not connect to server" } };
    }
  },

  async verifyOtp({ email, token }: { email: string; token: string; type?: string }): Promise<AuthResult<OtpData>> {
    try {
      const res = await post("/api/auth/otp/verify-email", { email, otp: token });
      const json = await res.json();
      if (!res.ok) return { data: { session: null }, error: { message: json.error ?? "Invalid OTP" } };
      return {
        data: {
          session: { access_token: json.access_token },
          user: json.user,
        },
        error: null,
      };
    } catch {
      return { data: { session: null }, error: { message: "Could not connect to server" } };
    }
  },

  async getSession(): Promise<{ data: { session: { access_token: string } | null } }> {
    const token = await getToken();
    return { data: { session: token ? { access_token: token } : null } };
  },
};

const storage = {
  from(_bucket: string) {
    return {
      async upload(path: string, _blob: unknown, _opts?: unknown) {
        return { data: { path }, error: null as { message: string } | null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: path } };
      },
    };
  },
};

export const supabase = { auth, storage };
