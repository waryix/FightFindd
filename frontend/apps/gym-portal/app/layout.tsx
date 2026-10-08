import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "../src/components/providers";

export const metadata: Metadata = {
  title: "FightFind Gym Portal",
  description: "Manage your gym on FightFind — memberships, requests, payments and profile.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
