import type { Metadata } from "next";
import Link from "next/link";
import "./gyms.css";

export const metadata: Metadata = {
  title: "FightFind Gyms — List your gym",
  description:
    "Register your boxing, MMA, Muay Thai, BJJ or wrestling gym on FightFind and reach fighters across India.",
};

export default function GymsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="gymShell">
      <header className="nav">
        <Link href="/gyms" className="brand">
          <span className="brandMark">FF</span>
          <span className="brandText">
            FightFind<span className="brandAccent">Gyms</span>
          </span>
        </Link>
        <nav className="navLinks">
          <Link href="/gyms/portal">Manage your gym</Link>
          <Link href="/gyms/register" className="navCta">
            Register your gym
          </Link>
        </nav>
      </header>

      <main className="main">{children}</main>

      <footer className="footer">
        <span>FightFind Gyms</span>
        <span className="footerDim">
          For boxing, MMA, kickboxing, Muay Thai, BJJ and wrestling gyms across India
        </span>
      </footer>
    </div>
  );
}
