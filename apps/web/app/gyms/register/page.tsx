"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../../lib/api";
import { authHeaders, getEmail, isLoggedIn } from "../../../lib/auth";
import { DISCIPLINES, label, type Gym, type GymDiscipline } from "../../../lib/types";
import { createGymOrder, checkout, verifyPayment } from "../../../lib/payments";

const REGISTRATION_FEE = 1000;

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [disciplines, setDisciplines] = useState<GymDiscipline[]>([]);
  const [monthlyFee, setMonthlyFee] = useState("");
  const [hasTrial, setHasTrial] = useState(false);
  const [timings, setTimings] = useState("");
  const [description, setDescription] = useState("");

  const [step, setStep] = useState<"idle" | "paying" | "creating">("idle");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Gym | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/gyms/login?next=/gyms/register");
      return;
    }
    setEmail(getEmail() ?? "");
  }, [router]);

  const toggleDiscipline = (d: GymDiscipline) => {
    setDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const isValid =
    name.trim() &&
    ownerName.trim() &&
    phone.trim() &&
    address.trim() &&
    city.trim() &&
    state.trim() &&
    disciplines.length > 0;

  const loading = step !== "idle";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError("Please fill in all required fields and pick at least one discipline.");
      return;
    }

    setError("");
    try {
      setStep("paying");
      const { order } = await createGymOrder();
      const payment = await checkout(order, `FightFind gym registration (₹${REGISTRATION_FEE})`);
      await verifyPayment(order.id, payment.paymentId, payment.signature);

      setStep("creating");
      const response = await fetch(`${API_URL}/api/gyms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim() || null,
          disciplines,
          monthlyFeeInr: monthlyFee ? parseInt(monthlyFee, 10) : null,
          hasTrialClass: hasTrial,
          timings: timings.trim() || null,
          description: description.trim() || null,
          payment_order_id: order.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not register your gym. Please try again.");
        return;
      }

      setCreated(data.gym as Gym);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setStep("idle");
    }
  };

  if (created) {
    return (
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="success">
          <div className="successIcon">✓</div>
          <h1 className="sectionTitle" style={{ margin: 0 }}>
            {created.name} is on FightFind!
          </h1>
          <p className="featureText">
            Registration fee of ₹{REGISTRATION_FEE} received. Thanks {created.owner_name} —
            your gym is now listed.
          </p>
          <div className="heroActions" style={{ justifyContent: "center" }}>
            <button className="btnPrimary" onClick={() => router.push("/gyms/portal")}>
              Go to your portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <span className="eyebrow">Register your gym</span>
      <h1 className="heroTitle" style={{ fontSize: 38, marginTop: 10 }}>
        Get your gym on FightFind
      </h1>
      <p className="heroSub" style={{ marginBottom: 24 }}>
        One-time registration fee of{" "}
        <strong style={{ color: "var(--accent)" }}>₹{REGISTRATION_FEE}</strong>, then ₹300/month.
      </p>

      <form className="formCard" onSubmit={handleSubmit}>
        {error ? <div className="errorBox">{error}</div> : null}

        <div className="formGrid">
          <div className="field fieldFull">
            <label className="label" htmlFor="name">Gym name *</label>
            <input id="name" className="input" placeholder="e.g. Knockout Boxing Club" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label className="label" htmlFor="owner">Owner name *</label>
            <input id="owner" className="input" placeholder="e.g. Arjun Singh" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>

          <div className="field">
            <label className="label" htmlFor="phone">Phone *</label>
            <input id="phone" className="input" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="field fieldFull">
            <label className="label" htmlFor="email">Email (login)</label>
            <input id="email" type="email" className="input" value={email} disabled />
          </div>

          <div className="field fieldFull">
            <label className="label" htmlFor="address">Address *</label>
            <input id="address" className="input" placeholder="Street, area" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="field">
            <label className="label" htmlFor="city">City *</label>
            <input id="city" className="input" placeholder="Bengaluru" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <div className="field">
            <label className="label" htmlFor="state">State *</label>
            <input id="state" className="input" placeholder="Karnataka" value={state} onChange={(e) => setState(e.target.value)} />
          </div>

          <div className="field">
            <label className="label" htmlFor="pincode">Pincode</label>
            <input id="pincode" className="input" placeholder="560038" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>

          <div className="field">
            <label className="label" htmlFor="fee">Monthly fee (INR)</label>
            <input id="fee" className="input" inputMode="numeric" placeholder="3500" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value.replace(/[^0-9]/g, ""))} />
          </div>

          <div className="field fieldFull">
            <span className="label">Disciplines *</span>
            <div className="chips">
              {DISCIPLINES.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`chip ${disciplines.includes(d) ? "chipActive" : ""}`}
                  onClick={() => toggleDiscipline(d)}
                >
                  {label(d)}
                </button>
              ))}
            </div>
          </div>

          <div className="field fieldFull">
            <label className="label" htmlFor="timings">Class timings</label>
            <input id="timings" className="input" placeholder="Mon–Sat 6–9am, 5–9pm" value={timings} onChange={(e) => setTimings(e.target.value)} />
          </div>

          <div className="field fieldFull">
            <label className="checkboxRow">
              <input type="checkbox" checked={hasTrial} onChange={(e) => setHasTrial(e.target.checked)} />
              We offer a free trial class
            </label>
          </div>

          <div className="field fieldFull">
            <label className="label" htmlFor="description">About your gym</label>
            <textarea id="description" className="textarea" placeholder="Tell fighters about your coaches, facilities and training style…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="formActions">
          <button type="submit" className="btnPrimary" disabled={loading}>
            {step === "paying"
              ? "Processing payment…"
              : step === "creating"
                ? "Creating your listing…"
                : `Pay ₹${REGISTRATION_FEE} & register`}
          </button>
          <span className="hint">* required · secure payment via Razorpay</span>
        </div>
      </form>
    </div>
  );
}
