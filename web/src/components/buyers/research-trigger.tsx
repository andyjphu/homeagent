"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

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
  const router = useRouter();

  async function handleTrigger() {
    setLoading(true);
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
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to trigger research:", err);
    }
    setLoading(false);
  }

  return (
    <Button onClick={handleTrigger} disabled={loading} size="sm">
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Search className="h-4 w-4 mr-1" />
      )}
      {loading ? "Starting..." : "Run Research"}
    </Button>
  );
}
