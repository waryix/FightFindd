"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePortalAuth } from "../../../src/lib/auth-context";
import { Button, Card, Field, inputClass } from "../../../src/components/ui";

type Mode = "login" | "signup";

export default function GymLoginPage() {
  const router = useRouter();
  const { status, requestOtp, verifyOtp } = usePortalAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [challengeId, setChallengeId] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/gym/dashboard");
  }, [status, router]);

  const looksLikeEmail = identifier.includes("@");
  const effectiveChannel = looksLikeEmail ? "email" : channel;

  const handleRequest = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestOtp({
        channel: effectiveChannel,
        identifier: identifier.trim(),
        purpose: mode === "login" ? "gym_owner_login" : "gym_owner_signup",
        name: mode === "signup" ? name.trim() : undefined,
      });
      setChallengeId(result.challengeId);
      setDevOtp(result.devOtp ?? "");
      setStep("otp");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("gym-owner") || err.message.includes("GYM_OWNER")
            ? "This account does not have gym-owner access."
            : err.message
          : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await verifyOtp({ challengeId, code, name: mode === "signup" ? name.trim() : undefined });
      if (!result.isOwner) {
        setError("This account does not have gym-owner access.");
        setStep("credentials");
        return;
      }
      router.replace("/gym/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white">
            FF
          </span>
          <div>
            <h1 className="text-2xl font-extrabold">FightFind Gym Portal</h1>
            <p className="text-sm text-muted">Manage memberships, requests and payments for your gym.</p>
          </div>
        </div>

        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-raised p-1">
            {(["login", "signup"] as Mode[]).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setMode(option);
                  setStep("credentials");
                  setError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${
                  mode === option ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {option === "login" ? "Log In" : "Create Account"}
              </button>
            ))}
          </div>

          {error ? (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          {step === "credentials" ? (
            <div className="space-y-4">
              {mode === "signup" ? (
                <Field label="Your name">
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Suresh Pillai" />
                </Field>
              ) : null}
              <Field label="Mobile number or email">
                <input
                  className={inputClass}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="+91 98765 43210 or owner@gym.in"
                  autoComplete="username"
                />
              </Field>
              <div className="flex gap-2 text-xs">
                {(["phone", "email"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setChannel(option)}
                    className={`rounded-full border px-3 py-1 font-semibold ${
                      effectiveChannel === option
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted"
                    }`}
                  >
                    {option === "phone" ? "Mobile OTP" : "Email OTP"}
                  </button>
                ))}
              </div>
              <Button onClick={handleRequest} loading={loading} disabled={identifier.trim().length < 6 || (mode === "signup" && name.trim().length < 2)} className="w-full">
                Send OTP
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Enter the 6-digit code sent to <span className="font-semibold text-foreground">{identifier}</span>.
              </p>
              {devOtp ? (
                <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                  Development OTP: <span className="font-mono font-bold">{devOtp}</span>
                </p>
              ) : null}
              <Field label="OTP">
                <input
                  className={`${inputClass} text-center text-xl font-bold tracking-[0.5em]`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                />
              </Field>
              <Button onClick={handleVerify} loading={loading} disabled={code.length !== 6} className="w-full">
                {mode === "signup" ? "Verify & Continue" : "Log In"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("credentials")} className="w-full">
                Back
              </Button>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-dark">
          Fighters sign in through the FightFind mobile app, not this portal.
        </p>
      </div>
    </main>
  );
}
