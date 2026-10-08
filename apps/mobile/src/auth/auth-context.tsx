import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, Entitlements } from "@fightfind/types";
import { api, bootstrapTokens, onAuthFailure } from "../api/client";
import { clearTokens, loadCachedUser, saveCachedUser, saveTokens } from "../storage/token-store";
import { track } from "../analytics";

export type AuthStatus = "loading" | "signed_out" | "guest" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  entitlements: Entitlements | null;
  isGuest: boolean;
  isPremium: boolean;
  requestOtp: (input: {
    channel: "phone" | "email";
    identifier: string;
    purpose?: "login" | "signup";
    name?: string;
  }) => Promise<{ challengeId: string; devOtp?: string; identifier: string }>;
  verifyOtp: (input: { challengeId: string; code: string; name?: string }) => Promise<AuthUser>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST_ENTITLEMENTS: Entitlements = {
  isPremium: false,
  premiumUntil: null,
  canUseAdvancedFilters: false,
  canSendUnlimitedRequests: false,
  hasProfileBoost: false,
  pendingRequestLimit: 3,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const me = await api.users.me();
      setUser(me.user);
      setEntitlements(me.entitlements);
      setStatus(me.user.isGuest ? "guest" : "authenticated");
      await saveCachedUser(me.user);
    } catch {
      // Offline or expired: fall back to cached identity preserving the UI shell.
      const cached = await loadCachedUser<AuthUser>();
      if (cached) {
        setUser(cached);
        setStatus(cached.isGuest ? "guest" : "authenticated");
        setEntitlements(GUEST_ENTITLEMENTS);
      } else {
        setUser(null);
        setEntitlements(null);
        setStatus("signed_out");
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrapTokens();
      const cached = await loadCachedUser<AuthUser>();
      if (cancelled) return;
      if (cached) {
        setUser(cached);
        setStatus(cached.isGuest ? "guest" : "authenticated");
      }
      await loadSession();
    })();
    const unsubscribe = onAuthFailure(() => {
      setUser(null);
      setEntitlements(null);
      setStatus("signed_out");
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadSession]);

  const requestOtp = useCallback<AuthContextValue["requestOtp"]>(async (input) => {
    const result = await api.auth.requestOtp({
      channel: input.channel,
      identifier: input.identifier,
      purpose: input.purpose ?? "login",
      name: input.name,
    });
    return { challengeId: result.challengeId, devOtp: result.devOtp, identifier: result.identifier };
  }, []);

  const verifyOtp = useCallback<AuthContextValue["verifyOtp"]>(async ({ challengeId, code, name }) => {
    const session = await api.auth.verifyOtp({ challengeId, code, name });
    await saveTokens({
      accessToken: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken ?? null,
    });
    await saveCachedUser(session.user);
    setUser(session.user);
    setStatus(session.user.isGuest ? "guest" : "authenticated");
    try {
      const me = await api.users.me();
      setEntitlements(me.entitlements);
    } catch {
      setEntitlements(GUEST_ENTITLEMENTS);
    }
    return session.user;
  }, []);

  const continueAsGuest = useCallback(async () => {
    const session = await api.auth.guest();
    await saveTokens({
      accessToken: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken ?? null,
    });
    await saveCachedUser(session.user);
    setUser(session.user);
    setEntitlements(GUEST_ENTITLEMENTS);
    setStatus("guest");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Best-effort: local sign-out always succeeds.
    }
    await clearTokens();
    setUser(null);
    setEntitlements(null);
    setStatus("signed_out");
  }, []);

  const refresh = useCallback(async () => {
    if (status === "signed_out" || status === "loading") return;
    try {
      const me = await api.users.me();
      setUser(me.user);
      setEntitlements(me.entitlements);
      setStatus(me.user.isGuest ? "guest" : "authenticated");
    } catch {
      // Keep current state; a later request can retry.
    }
  }, [status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      entitlements,
      isGuest: status === "guest",
      isPremium: entitlements?.isPremium ?? false,
      requestOtp,
      verifyOtp,
      continueAsGuest,
      signOut,
      refresh,
    }),
    [status, user, entitlements, requestOtp, verifyOtp, continueAsGuest, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Tracks a gated action: returns false and lets the caller prompt for signup. */
export function useCanTransact(): boolean {
  const { status } = useAuth();
  return status === "authenticated";
}

export function trackFunnelStep(name: string, properties?: Record<string, unknown>) {
  track(name, properties);
}
