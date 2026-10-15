"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../../lib/api";
import { authHeaders, clearSession, getEmail, isLoggedIn } from "../../../lib/auth";
import { DISCIPLINES, label, type Gym, type GymDiscipline } from "../../../lib/types";
import { createMonthlyOrder, checkout, verifyPayment } from "../../../lib/payments";

const MONTHLY_FEE = 300;

export default function PortalPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsRegister, setNeedsRegister] = useState(false);

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [disciplines, setDisciplines] = useState<GymDiscipline[]>([]);
  const [monthlyFee, setMonthlyFee] = useState("");
  const [hasTrial, setHasTrial] = useState(false);
  const [timings, setTimings] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");

  const fillForm = useCallback((g: Gym) => {
    setName(g.name ?? "");
    setOwnerName(g.owner_name ?? "");
    setPhone(g.phone ?? "");
    setContactEmail(g.email ?? "");
    setAddress(g.address ?? "");
    setCity(g.city ?? "");
    setState(g.state ?? "");
    setPincode(g.pincode ?? "");
    setDisciplines(g.disciplines ?? []);
    setMonthlyFee(g.monthly_fee_inr ? String(g.monthly_fee_inr) : "");
    setHasTrial(Boolean(g.has_trial_class));
    setTimings(g.timings ?? "");
    setDescription(g.description ?? "");
  }, []);

  const loadGym = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/gyms/mine`, {
        headers: { ...authHeaders() },
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load your gym.");
        return;
      }
      const mine = data.gym as Gym | null;
      setGym(mine);
      setNeedsRegister(!mine);
      if (mine) fillForm(mine);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [fillForm]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/gyms/login?next=/gyms/portal");
      return;
    }
    setEmail(getEmail() ?? "");
    loadGym();
  }, [router, loadGym]);

  const handleLogout = () => {
    clearSession();
    router.replace("/gyms/login");
  };

  const toggleDiscipline = (d: GymDiscipline) => {
    setDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    setSaving(true);
    setSavedMsg("");
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/gyms/${gym.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          owner_name: ownerName.trim(),
          phone: phone.trim(),
          email: contactEmail.trim() || null,
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim() || null,
          disciplines,
          monthly_fee_inr: monthlyFee ? parseInt(monthlyFee, 10) : null,
          has_trial_class: hasTrial ? 1 : 0,
          timings: timings.trim() || null,
          description: description.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save changes.");
        return;
      }
      setGym(data.gym as Gym);
      setSavedMsg("Profile updated.");
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const handleMonthlyPayment = async () => {
    if (!gym) return;
    setPaying(true);
    setPayMsg("");
    setError("");
    try {
      const { order } = await createMonthlyOrder(gym.id);
      const payment = await checkout(order, `FightFind gym monthly fee (₹${MONTHLY_FEE})`);
      await verifyPayment(order.id, payment.paymentId, payment.signature);
      setPayMsg("Monthly fee paid. Thanks!");
      await loadGym();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="container"><div className="empty">Loading…</div></div>;
  }

  if (needsRegister) {
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <span className="eyebrow">Your portal</span>
        <h1 className="heroTitle" style={{ fontSize: 34, marginTop: 10 }}>
          No gym yet
        </h1>
        <p className="heroSub" style={{ marginBottom: 20 }}>
          {email} isn&apos;t linked to a gym listing yet. Register your gym to get started.
        </p>
        <div className="heroActions">
          <button className="btnPrimary" onClick={() => router.push("/gyms/register")}>
            Register your gym
          </button>
          <button className="btnGhost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="errorBox">{error || "Gym not found."}</div>
        <button className="btnGhost" onClick={handleLogout}>Log out</button>
      </div>
    );
  }

  const monthlyActive = gym.monthly_status === "active";

  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <span className="eyebrow">Your portal</span>
      <h1 className="heroTitle" style={{ fontSize: 34, marginTop: 10 }}>
        {gym.name}
      </h1>

      <div className="gymCard" style={{ marginTop: 20, marginBottom: 24 }}>
        <div className="gymMeta">
          <div>
            <div className="metaLabel">Signed in as</div>
            <div className="metaValue">{email}</div>
          </div>
          <div>
            <div className="metaLabel">Registration</div>
            <div className="metaValue" style={{ color: gym.registration_paid ? "var(--green)" : "var(--accent)" }}>
              {gym.registration_paid ? "Paid (₹1000)" : "Unpaid"}
            </div>
          </div>
          <div>
            <div className="metaLabel">Monthly plan</div>
            <div className="metaValue" style={{ color: monthlyActive ? "var(--green)" : "var(--accent)" }}>
              {monthlyActive ? "Active" : "Inactive"}
            </div>
          </div>
          <div>
            <div className="metaLabel">Next billing</div>
            <div className="metaValue">
              {gym.next_billing_at ? new Date(gym.next_billing_at + "Z").toLocaleDateString("en-IN") : "—"}
            </div>
          </div>
        </div>

        {payMsg ? <div className="trialBanner">{payMsg}</div> : null}

        <div className="heroActions">
          <button className="btnPrimary" onClick={handleMonthlyPayment} disabled={paying}>
            {paying ? "Processing…" : `Pay ₹${MONTHLY_FEE} monthly fee`}
          </button>
          <span className="hint">Recurring monthly fee · secure via Razorpay</span>
        </div>
      </div>

      <form className="formCard" onSubmit={handleSave}>
        {error ? <div className="errorBox">{error}</div> : null}
        {savedMsg ? <div className="trialBanner">{savedMsg}</div> : null}

        <div className="formGrid">
          <div className="field fieldFull">
            <label className="label">Gym name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Owner name *</label>
            <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Phone *</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field fieldFull">
            <label className="label">Contact email</label>
            <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="field fieldFull">
            <label className="label">Address</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">State</label>
            <input className="input" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Pincode</label>
            <input className="input" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Monthly fee (INR)</label>
            <input className="input" inputMode="numeric" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value.replace(/[^0-9]/g, ""))} />
          </div>
          <div className="field fieldFull">
            <span className="label">Disciplines</span>
            <div className="chips">
              {DISCIPLINES.map((d) => (
                <button type="button" key={d} className={`chip ${disciplines.includes(d) ? "chipActive" : ""}`} onClick={() => toggleDiscipline(d)}>
                  {label(d)}
                </button>
              ))}
            </div>
          </div>
          <div className="field fieldFull">
            <label className="label">Class timings</label>
            <input className="input" value={timings} onChange={(e) => setTimings(e.target.value)} />
          </div>
          <div className="field fieldFull">
            <label className="checkboxRow">
              <input type="checkbox" checked={hasTrial} onChange={(e) => setHasTrial(e.target.checked)} />
              We offer a free trial class
            </label>
          </div>
          <div className="field fieldFull">
            <label className="label">About your gym</label>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="formActions">
          <button type="submit" className="btnPrimary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="btnGhost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </form>
    </div>
  );
}
