"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppShell } from "../../../src/components/app-shell";
import { usePortalAuth } from "../../../src/lib/auth-context";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = usePortalAuth();

  useEffect(() => {
    if (status === "signed_out") router.replace("/gym/login");
    if (status === "not_owner") router.replace("/gym/login");
    if (status === "authenticated" && pathname === "/gym/onboarding") {
      // Onboarding is rendered inside the shell too; nothing to redirect.
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm">Checking your gym-owner access…</p>
        </div>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
