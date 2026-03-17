"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

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
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Poll /api/research/process to advance the pipeline (enrichment → scoring → complete)
  const startPipelinePolling = useCallback(
    (taskId: string) => {
      taskIdRef.current = taskId;
      setProcessing(true);

      pollingRef.current = setInterval(async () => {
        try {
          // Advance the pipeline by one step
          const processRes = await fetch("/api/research/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });

          const processData = await processRes.json();
          const stage = processData.stage;
          const status = processData.status;

          // Update info message based on stage
          if (stage === "enrichment") {
            setInfo("Enriching properties with neighborhood data...");
          } else if (stage === "scoring") {
            setInfo("AI scoring properties against buyer criteria...");
          } else if (stage === "complete" || status === "completed") {
            // Pipeline finished
            setInfo("Research complete — properties enriched and scored.");
            setProcessing(false);
            setDone(true);
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            router.refresh();
            return;
          } else if (status === "failed") {
            setError(processData.error ?? "Pipeline failed");
            setProcessing(false);
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            return;
          }
        } catch {
          // Ignore fetch errors — will retry on next interval
        }
      }, 4000);
    },
    [router]
  );

  async function handleTrigger() {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setLoading(true);
    setProcessing(false);
    setError(null);
    setInfo(null);
    setDone(false);

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
        setError(data.error ?? "Failed to start research");
      } else if (data.error) {
        setError(data.error);
      } else {
        const saved = data.properties_saved ?? data.task?.output_data?.properties_saved;
        const found = data.properties_found ?? data.task?.output_data?.properties_found;
        const taskId = data.task?.id;

        if (saved) {
          setInfo(`Found ${found} listings, saved ${saved}. Enriching...`);
        } else {
          setInfo("Research started. Processing...");
        }

        // Start polling to drive the enrichment + scoring pipeline.
        // The trigger returns the original task insert (status may be "queued"),
        // but the route updates it to "running" internally — so just check for a taskId.
        if (taskId) {
          startPipelinePolling(taskId);
        }
      }

      router.refresh();
    } catch (err) {
      setError("Failed to start research");
      console.error("Failed to trigger research:", err);
    }
    setLoading(false);
  }

  const isActive = loading || processing;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        onClick={handleTrigger}
        disabled={isActive}
        size="sm"
        variant="outline"
        title="Search listings, enrich with neighborhood data, and run AI scoring"
      >
        {isActive ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-500" />
        ) : (
          <Sparkles className="h-4 w-4 mr-1" />
        )}
        {loading ? "Searching..." : processing ? "Processing..." : "AI Research"}
      </Button>
      {error && (
        <span className="text-xs text-destructive flex items-center gap-1 max-w-80">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
      {info && !error && (
        <span className="text-xs text-muted-foreground flex items-center gap-1 max-w-80">
          {processing ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <Info className="h-3 w-3 shrink-0" />
          )}
          {info}
        </span>
      )}
    </div>
  );
}
