import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FightFind Gyms — List your gym",
  description:
    "Register your boxing, MMA, Muay Thai, BJJ or wrestling gym on FightFind and reach fighters across India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <Link href="/" className="brand">
            <span className="brandMark">FF</span>
            <span className="brandText">
              FightFind<span className="brandAccent">Gyms</span>
            </span>
          </Link>
          <nav className="navLinks">
            <Link href="/manage">Manage your gym</Link>
            <Link href="/register" className="navCta">
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
      </body>
    </html>
  );
}
