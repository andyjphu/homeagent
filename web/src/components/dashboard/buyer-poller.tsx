"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 30_000;

/**
 * Invisible client component that refreshes the buyer dashboard
 * every 30 seconds so new properties and deal updates appear
 * without manual page reload.
 */
export function BuyerDashboardPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
