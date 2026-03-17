"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Invisible client component that listens for "properties-updated" events
 * (dispatched by SearchListingsModal and AddPropertyModal after import)
 * and triggers a Next.js router.refresh() to re-fetch server component data.
 */
export function PropertiesRefreshListener() {
  const router = useRouter();

  useEffect(() => {
    function handleUpdate() {
      router.refresh();
    }

    window.addEventListener("properties-updated", handleUpdate);
    return () => window.removeEventListener("properties-updated", handleUpdate);
  }, [router]);

  return null;
}
