"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertTriangle } from "lucide-react";

export function ResearchTrigger({
  buyerId,
  agentId,
  intentProfile,
}: {
  buyerId: string;
  agentId: string;
  intentProfile: any;
}) {
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const router = useRouter();

  async function handleTrigger() {
    setLoading(true);
    setWarning(null);
    try {
      const response = await fetch("/api/research/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          agentId,
          intentProfile,
          taskType: "full_research_pipeline",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.backendReachable) {
          setWarning("Research service unavailable — task queued but won't run until the service is online.");
        }
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to trigger research:", err);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleTrigger} disabled={loading} size="sm">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Search className="h-4 w-4 mr-1" />
        )}
        {loading ? "Starting..." : "Run Research"}
      </Button>
      {warning && (
        <span className="text-xs text-amber-600 flex items-center gap-1 max-w-64">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {warning}
        </span>
      )}
    </div>
  );
}
