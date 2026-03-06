"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, ExternalLink } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const router = useRouter();

  async function handleTrigger() {
    setLoading(true);
    setError(null);
    setLiveUrl(null);
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

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to start research");
      } else if (data.error) {
        setError(data.error);
      } else if (data.liveUrl) {
        setLiveUrl(data.liveUrl);
      }

      router.refresh();
    } catch (err) {
      setError("Failed to start research");
      console.error("Failed to trigger research:", err);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button onClick={handleTrigger} disabled={loading} size="sm">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-1" />
        )}
        {loading ? "Starting..." : "Run AI Research"}
      </Button>
      {error && (
        <span className="text-xs text-destructive flex items-center gap-1 max-w-80">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
      {liveUrl && (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Watch live
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
