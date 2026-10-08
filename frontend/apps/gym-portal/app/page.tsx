"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePortalAuth } from "../src/lib/auth-context";

export default function HomePage() {
  const { status } = usePortalAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") router.replace("/gym/dashboard");
    else router.replace("/gym/login");
  }, [status, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </main>
  );
}
