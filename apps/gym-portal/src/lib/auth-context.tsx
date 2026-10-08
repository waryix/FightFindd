"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@fightfind/types";
import { api, setAccessToken } from "./api";

export type PortalStatus = "loading" | "signed_out" | "not_owner" | "authenticated";

interface PortalAuthValue {
  status: PortalStatus;
  user: AuthUser | null;
  requestOtp: (input: {
    channel: "phone" | "email";
    identifier: string;
    purpose: "gym_owner_login" | "gym_owner_signup";
    name?: string;
  }) => Promise<{ challengeId: string; devOtp?: string }>;
  verifyOtp: (input: { challengeId: string; code: string; name?: string }) => Promise<{ isOwner: boolean }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthValue | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PortalStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const evaluate = useCallback(async () => {
    try {
      const me = await api.users.me();
      setUser(me.user);
      setStatus(me.user.roles.includes("GYM_OWNER") ? "authenticated" : "not_owner");
    } catch {
      setUser(null);
      setStatus("signed_out");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      // The refresh token lives in an httpOnly cookie; silently renew on load.
      try {
        const session = await api.auth.refresh();
        setAccessToken(session.tokens.accessToken);
      } catch {
        setAccessToken(null);
        setStatus("signed_out");
        return;
      }
      await evaluate();
    })();

    const onFailure = () => setStatus("signed_out");
    window.addEventListener("ff-auth-failure", onFailure);
    return () => window.removeEventListener("ff-auth-failure", onFailure);
  }, [evaluate]);

  const requestOtp = useCallback<PortalAuthValue["requestOtp"]>(async (input) => {
    const result = await api.auth.requestOtp(input);
    return { challengeId: result.challengeId, devOtp: result.devOtp };
  }, []);

  const verifyOtp = useCallback<PortalAuthValue["verifyOtp"]>(async ({ challengeId, code, name }) => {
    const session = await api.auth.verifyOtp({ challengeId, code, name });
    setAccessToken(session.tokens.accessToken);
    const isOwner = session.user.roles.includes("GYM_OWNER");
    setUser(session.user);
    setStatus(isOwner ? "authenticated" : "not_owner");
    return { isOwner };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    setStatus("signed_out");
  }, []);

  const value = useMemo<PortalAuthValue>(
    () => ({ status, user, requestOtp, verifyOtp, signOut, refresh: evaluate }),
    [status, user, requestOtp, verifyOtp, signOut, evaluate],
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth(): PortalAuthValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used inside PortalAuthProvider");
  return ctx;
}
