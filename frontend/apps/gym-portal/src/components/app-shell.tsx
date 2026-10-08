"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import { usePortalAuth } from "../lib/auth-context";
import { StatusChip } from "./ui";

const NAV = [
  { href: "/gym/dashboard", label: "Dashboard" },
  { href: "/gym/requests", label: "Requests" },
  { href: "/gym/members", label: "Members" },
  { href: "/gym/profile", label: "Gym Profile" },
  { href: "/gym/payments", label: "Payments" },
  { href: "/gym/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = usePortalAuth();

  const gymsQuery = useQuery({ queryKey: ["owner-gyms"], queryFn: () => api.gymOwner.listGyms() });
  const primaryGym = gymsQuery.data?.gyms[0] ?? null;

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface/40 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-white">
            FF
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">FightFind</p>
            <p className="text-[11px] text-muted">Gym Portal</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <button
            onClick={async () => {
              await signOut();
              router.replace("/gym/login");
            }}
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-white lg:hidden">
              FF
            </span>
            <div>
              <p className="text-sm font-bold">{primaryGym?.name ?? "Your gym"}</p>
              <p className="text-[11px] text-muted">{user?.name ?? user?.phone ?? user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {primaryGym ? <StatusChip status={primaryGym.status} /> : null}
            {primaryGym ? <StatusChip status={primaryGym.verificationStatus} /> : null}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 lg:px-6 lg:pb-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur lg:hidden">
          {NAV.slice(0, 5).map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 py-2.5 text-center text-[11px] font-semibold ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
