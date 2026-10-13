import Link from "next/link";

const FEATURES = [
  {
    icon: "🥊",
    title: "Reach fighters nearby",
    text: "Get discovered by boxers, MMA fighters, kickboxers, Muay Thai and BJJ athletes searching for a place to train.",
  },
  {
    icon: "🎯",
    title: "Filter by discipline",
    text: "List every style you teach so fighters find the exact gym they're looking for.",
  },
  {
    icon: "🎟️",
    title: "Offer a trial class",
    text: "Flag a free trial class and let new members walk in and try a session.",
  },
  {
    icon: "📍",
    title: "Show up on the map",
    text: "Your address and location help fighters find gyms within their preferred radius.",
  },
];

const STEPS = [
  { n: 1, title: "Fill in your gym details", text: "Name, owner, contact, address and the disciplines you offer." },
  { n: 2, title: "Add fees & timings", text: "Monthly fee, class timings and whether you offer a free trial." },
  { n: 3, title: "Go live on FightFind", text: "Your gym appears in the FightFind app for fighters across India." },
];

export default function HomePage() {
  return (
    <div className="container">
      <section className="hero">
        <span className="eyebrow">For gym owners</span>
        <h1 className="heroTitle">
          List your gym on <span style={{ color: "var(--accent)" }}>FightFind</span>
        </h1>
        <p className="heroSub">
          Register your combat-sports gym and get discovered by boxers, MMA fighters,
          kickboxers, Muay Thai and BJJ athletes training across India.
        </p>
        <div className="heroActions">
          <Link href="/register" className="btnPrimary">
            Register your gym
          </Link>
          <Link href="/manage" className="btnGhost">
            Manage your gym
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="sectionTitle">Simple pricing</h2>
        <div className="features">
          <div className="feature">
            <div className="featureIcon">🏷️</div>
            <div className="featureTitle">₹1,000 one-time</div>
            <p className="featureText">
              A single registration fee to list your gym on FightFind.
            </p>
          </div>
          <div className="feature">
            <div className="featureIcon">🔁</div>
            <div className="featureTitle">₹300 / month</div>
            <p className="featureText">
              A recurring monthly fee to keep your gym listed and discoverable.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="sectionTitle">Why list on FightFind?</h2>
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="featureIcon">{f.icon}</div>
              <div className="featureTitle">{f.title}</div>
              <p className="featureText">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="sectionTitle">How it works</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="stepNum">{s.n}</div>
              <div className="featureTitle">{s.title}</div>
              <p className="featureText">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
