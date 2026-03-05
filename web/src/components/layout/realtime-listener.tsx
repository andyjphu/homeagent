"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Invisible component that subscribes to activity_feed inserts
 * for the current agent and triggers a router.refresh() so that
 * server components (dashboard stats, leads, deals) re-fetch.
 *
 * Also dispatches a custom event so sibling client components
 * (TopBar notification badge) can react without their own subscription.
 */
export function RealtimeListener({ agentId }: { agentId: string }) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNewActivity = useCallback(
    (payload: Record<string, unknown>) => {
      // Dispatch custom event for TopBar badge and other listeners
      window.dispatchEvent(
        new CustomEvent("ha:new-activity", { detail: payload })
      );

      // Debounce router.refresh to avoid hammering during bursts
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.refresh();
      }, 1500);
    },
    [router]
  );

  useEffect(() => {
    const supabase = createClient() as ReturnType<typeof createClient>;

    const channel = (supabase as unknown as Record<string, CallableFunction>)
      .channel(`agent-${agentId}-dashboard`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload: Record<string, unknown>) => {
          handleNewActivity(payload);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      (supabase as unknown as Record<string, CallableFunction>).removeChannel(channel);
    };
  }, [agentId, handleNewActivity]);

  return null;
}
