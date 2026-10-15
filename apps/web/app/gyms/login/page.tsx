"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendOtp, verifyOtp, setSession, isLoggedIn } from "../../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/gyms/portal");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dest = params.get("next");
    if (dest && dest.startsWith("/")) setNext(dest);

    if (isLoggedIn()) router.replace(dest && dest.startsWith("/") ? dest : "/gyms/portal");
  }, [router]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await sendOtp(value);
      setDevOtp(result.devOtp ?? "");
      setStage("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError("Enter the code we emailed you.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await verifyOtp(email.trim().toLowerCase(), otp.trim());
      setSession(session);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <span className="eyebrow">Gym owner login</span>
      <h1 className="heroTitle" style={{ fontSize: 34, marginTop: 10 }}>
        Sign in to your portal
      </h1>
      <p className="heroSub" style={{ marginBottom: 20 }}>
        We&apos;ll email you a one-time code. No password needed.
      </p>

      <form className="formCard" onSubmit={stage === "email" ? handleSend : handleVerify}>
        {error ? <div className="errorBox">{error}</div> : null}

        <div className="formGrid">
          <div className="field fieldFull">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="gym@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={stage === "otp"}
            />
          </div>

          {stage === "otp" ? (
            <div className="field fieldFull">
              <label className="label" htmlFor="otp">Verification code</label>
              <input
                id="otp"
                className="input"
                inputMode="numeric"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
              />
              {devOtp ? (
                <span className="hint">Dev mode — your code is {devOtp}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="formActions">
          <button type="submit" className="btnPrimary" disabled={busy}>
            {busy
              ? "Please wait…"
              : stage === "email"
                ? "Send login code"
                : "Verify & sign in"}
          </button>
          {stage === "otp" ? (
            <button
              type="button"
              className="btnGhost"
              onClick={() => {
                setStage("email");
                setOtp("");
                setDevOtp("");
              }}
            >
              Use a different email
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
