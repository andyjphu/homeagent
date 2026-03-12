"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, Info } from "lucide-react";

export function ResearchTrigger({
  buyerId,
  agentId,
  intentProfile,
}: {
  buyerId: string;
  agentId: string;
  intentProfile: Record<string, unknown>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  async function handleTrigger() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/research/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          agentId,
          intentProfile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to start enrichment");
      } else if (data.error) {
        setError(data.error);
      } else {
        if (data.service === "api_fallback") {
          setInfo("Using API enrichment (research service unavailable)");
        } else {
          setInfo(`Enriching ${data.propertyCount} properties...`);
        }
      }

      router.refresh();
    } catch (err) {
      setError("Failed to start enrichment");
      console.error("Failed to trigger research:", err);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        onClick={handleTrigger}
        disabled={loading}
        size="sm"
        variant="outline"
        title="Search listings, enrich with neighborhood data, and run AI scoring"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-1" />
        )}
        {loading ? "Researching..." : "AI Research"}
      </Button>
      {error && (
        <span className="text-xs text-destructive flex items-center gap-1 max-w-80">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
      {info && !error && (
        <span className="text-xs text-muted-foreground flex items-center gap-1 max-w-80">
          <Info className="h-3 w-3 shrink-0" />
          {info}
        </span>
      )}
    </div>
  );
}
