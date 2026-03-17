"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  TrendingUp,
} from "lucide-react";

interface ResearchTask {
  id: string;
  task_type: string;
  status: string;
  created_at: string;
  output_data: {
    pipeline_stage?: string;
    properties_found?: number;
    properties_saved?: number;
    properties_scored?: number;
  } | null;
  error_message: string | null;
  input_params: {
    triggered_by?: string;
  } | null;
}

export function BuyerResearch({
  dashboardToken,
}: {
  dashboardToken: string;
}) {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Fetch research history
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/${dashboardToken}/research`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } catch {
      // Silently fail
    }
    setLoadingTasks(false);
  }, [dashboardToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Poll for active task progress
  useEffect(() => {
    const activeTask = tasks.find(
      (t) => t.status === "running" || t.status === "queued"
    );
    if (!activeTask) return;

    setProcessing(true);
    const stage = activeTask.output_data?.pipeline_stage;
    if (stage === "searching") setInfo("Searching for properties...");
    else if (stage === "enrichment")
      setInfo("Enriching properties with neighborhood data...");
    else if (stage === "scoring")
      setInfo("AI scoring properties against your criteria...");

    const interval = setInterval(async () => {
      await fetchTasks();
    }, 5000);

    return () => clearInterval(interval);
  }, [tasks, fetchTasks]);

  // Detect when processing completes
  useEffect(() => {
    if (processing && !tasks.some((t) => t.status === "running" || t.status === "queued")) {
      setProcessing(false);
      setDone(true);
      setInfo("Research complete! New properties have been added to your list.");
    }
  }, [tasks, processing]);

  async function handleResearch() {
    setLoading(true);
    setError(null);
    setInfo(null);
    setDone(false);

    try {
      const res = await fetch(`/api/dashboard/${dashboardToken}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to start research");
      } else {
        const found = data.properties_found ?? 0;
        const saved = data.properties_saved ?? 0;
        if (saved > 0) {
          setInfo(
            `Found ${found} listings, saving ${saved} best matches. Enriching...`
          );
          setProcessing(true);
        } else if (found === 0) {
          setInfo("No new listings found matching your criteria.");
          setDone(true);
        } else {
          setInfo("Research started, processing...");
          setProcessing(true);
        }
        fetchTasks();
      }
    } catch {
      setError("Failed to start research — please try again.");
    }
    setLoading(false);
  }

  const isActive = loading || processing;
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const hasHistory = completedTasks.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">AI Research</h2>
        <Button
          onClick={handleResearch}
          disabled={isActive}
          size="sm"
          className="gap-1.5"
        >
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading
            ? "Searching..."
            : processing
            ? "Processing..."
            : "Find Properties"}
        </Button>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {info && !error && (
        <div
          className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 ${
            done
              ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
              : "text-muted-foreground bg-muted/50"
          }`}
        >
          {processing ? (
            <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin" />
          ) : done ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          {info}
        </div>
      )}

      {/* Explainer card when no research has been done */}
      {!hasHistory && !isActive && !done && !loadingTasks && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center space-y-2">
            <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">
              Let AI find properties for you
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Based on your preferences, we&apos;ll search listings, analyze
              neighborhoods, and score properties against your criteria.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Research history */}
      {hasHistory && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Research History
          </p>
          {completedTasks.slice(0, 5).map((task) => {
            const found = task.output_data?.properties_found ?? 0;
            const saved = task.output_data?.properties_saved ?? 0;
            const scored = task.output_data?.properties_scored ?? 0;
            const isBuyerTriggered =
              task.input_params?.triggered_by === "buyer";
            const date = new Date(task.created_at);

            return (
              <div
                key={task.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border text-sm"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {isBuyerTriggered ? (
                    <Search className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {isBuyerTriggered ? "Your search" : "Agent research"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Found {found} listings
                    {saved > 0 && `, saved ${saved}`}
                    {scored > 0 && `, scored ${scored}`}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  {date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
