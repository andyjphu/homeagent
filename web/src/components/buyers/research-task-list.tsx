"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Circle,
  ExternalLink,
  Eye,
} from "lucide-react";

interface ExecutionEvent {
  timestamp: string;
  action: string;
  data?: any;
}

interface Task {
  id: string;
  task_type: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  execution_log: ExecutionEvent[] | null;
  output_data: any;
}

// Human-readable stage descriptions
const STAGE_LABELS: Record<string, string> = {
  zillow_search: "Searching Zillow for properties...",
  enrichment: "Enriching properties (schools, walkability, commute)...",
  scoring: "Scoring properties against buyer criteria...",
  complete: "Research complete",
};

const ENRICHMENT_TYPE_LABELS: Record<string, string> = {
  school: "Looking up school ratings",
  walkscore: "Checking walk score",
  commute: "Calculating commute times",
};

// Event → human label mapping
const EVENT_LABELS: Record<string, (data?: any) => string> = {
  pipeline_start: () => "Pipeline started",
  stage_zillow_start: () => "Searching Zillow...",
  stage_zillow_done: (d) => `Found ${d?.property_count ?? "?"} properties on Zillow`,
  stage_zillow_failed: (d) => `Zillow search failed: ${d?.error ?? "unknown error"}`,
  no_properties_found: () => "No properties found",
  candidates_selected: (d) => `Selected ${d?.count ?? "?"} top candidates`,
  property_saved: (d) => `Saved: ${d?.address ?? "property"}`,
  property_save_error: (d) => `Failed to save: ${d?.address ?? "property"}`,
  stage_crossref_start: (d) => `Enriching ${d?.property_count ?? "?"} properties...`,
  stage_crossref_skipped: () => "Enrichment skipped",
  crossref_start: (d) => `Enriching ${d?.address ?? "property"} (${d?.index}/${d?.total})`,
  property_enriched: (d) => `Updated: ${d?.fields_updated?.join(", ") ?? "enriched"}`,
  property_no_enrichment: () => "No enrichment data found",
  property_not_found: () => "Property not found in database",
  school_failed: (d) => `School search failed: ${d?.error ?? d?.address ?? "unknown"}`,
  walkscore_failed: (d) => `Walk score failed: ${d?.error ?? d?.address ?? "unknown"}`,
  commute_failed: (d) => `Commute failed: ${d?.error ?? d?.address ?? "unknown"}`,
  stage_scoring_start: (d) => `Scoring ${d?.property_count ?? "?"} properties...`,
  stage_scoring_done: (d) => `Scored ${d?.scored ?? 0} properties`,
  stage_scoring_failed: (d) => `Scoring failed: ${d?.error ?? "unknown"}`,
  pipeline_complete: (d) =>
    `Complete: ${d?.property_ids?.length ?? 0} properties, ${d?.enriched ?? 0} enriched, ${d?.scored ?? 0} scored`,
  pipeline_error: (d) => `Pipeline error: ${d?.error ?? "unknown"}`,
  search_page_start: (d) => `Searching page ${d?.page ?? "?"}`,
  search_page_done: (d) => `Page ${d?.page}: found ${d?.found ?? 0} listings`,
  search_complete: (d) => `Search complete: ${d?.total_listings ?? 0} total listings`,
};

const WARN_EVENTS = new Set([
  "school_failed",
  "walkscore_failed",
  "commute_failed",
  "stage_zillow_failed",
  "stage_scoring_failed",
  "property_not_found",
  "property_no_enrichment",
  "property_save_error",
  "pipeline_error",
  "search_page_parse_error",
  "search_page_error",
]);

const SUCCESS_EVENTS = new Set([
  "pipeline_complete",
  "property_enriched",
  "property_saved",
  "stage_zillow_done",
  "stage_scoring_done",
  "search_complete",
]);

// Events to show by default (hide noisy sub-events unless expanded)
const PRIMARY_EVENTS = new Set([
  "pipeline_start",
  "stage_zillow_start",
  "stage_zillow_done",
  "stage_zillow_failed",
  "no_properties_found",
  "candidates_selected",
  "stage_crossref_start",
  "stage_crossref_skipped",
  "crossref_start",
  "property_enriched",
  "stage_scoring_start",
  "stage_scoring_done",
  "stage_scoring_failed",
  "pipeline_complete",
  "pipeline_error",
  "search_complete",
]);

function formatEventLabel(event: ExecutionEvent): string {
  const formatter = EVENT_LABELS[event.action];
  if (formatter) return formatter(event.data);
  return event.action.replace(/_/g, " ");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventIcon({ action }: { action: string }) {
  if (WARN_EVENTS.has(action)) {
    return <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />;
  }
  if (SUCCESS_EVENTS.has(action)) {
    return <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />;
  }
  return <Circle className="h-2.5 w-2.5 text-muted-foreground shrink-0 ml-px" />;
}

function getStageDescription(task: Task): string | null {
  const od = task.output_data;
  if (!od?.pipeline_stage) return null;

  const stage = od.pipeline_stage;
  if (stage === "enrichment" && od.enrichment_type) {
    const typeLabel = ENRICHMENT_TYPE_LABELS[od.enrichment_type] ?? od.enrichment_type;
    const propIdx = od.enrichment_index ?? 0;
    const total = od.property_ids?.length ?? "?";
    return `${typeLabel} (property ${propIdx + 1}/${total})...`;
  }
  return STAGE_LABELS[stage] ?? stage;
}

function LivePreview({ liveUrl }: { liveUrl: string }) {
  const [showIframe, setShowIframe] = useState(false);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowIframe(!showIframe)}
        >
          <Eye className="h-3 w-3 mr-1" />
          {showIframe ? "Hide preview" : "Watch live"}
        </Button>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Open in new tab
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {/* Keep iframe mounted but hidden so it doesn't reset on re-render */}
      <div
        className={`rounded-md border overflow-hidden bg-muted ${showIframe ? "" : "hidden"}`}
      >
        <iframe
          src={liveUrl}
          className="w-full h-[300px]"
          title="Live browser preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}

function TaskTimeline({ events, isRunning }: { events: ExecutionEvent[]; isRunning: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll
    ? events
    : events.filter((e) => PRIMARY_EVENTS.has(e.action) || WARN_EVENTS.has(e.action));
  const hiddenCount = events.length - displayed.length;

  return (
    <div className="mt-3 space-y-0">
      <div className="relative pl-4 border-l border-border space-y-1.5">
        {displayed.map((event, i) => {
          const isLast = i === displayed.length - 1;
          const isActive = isRunning && isLast;

          return (
            <div key={`${event.timestamp}-${event.action}-${i}`} className="flex items-start gap-2 relative">
              <div className="absolute -left-[calc(1rem+4.5px)] top-1.5">
                <EventIcon action={event.action} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-xs ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                  {isActive && (
                    <Loader2 className="h-3 w-3 animate-spin inline mr-1 -mt-0.5" />
                  )}
                  {formatEventLabel(event)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatTime(event.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground ml-4 mt-1"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show less" : `+${hiddenCount} more events`}
        </button>
      )}
    </div>
  );
}

export function ResearchTaskList({ buyerId }: { buyerId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tasksRef = useRef<Task[]>([]);
  const expandedOnceRef = useRef(false);

  const fetchTasks = useCallback(async () => {
    const supabase = createClient() as any;
    const { data } = await supabase
      .from("agent_tasks")
      .select("id, task_type, status, created_at, started_at, completed_at, failed_at, error_message, execution_log, output_data")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      tasksRef.current = data;
      setTasks(data);
      // Auto-expand active task only on first load
      if (!expandedOnceRef.current) {
        const active = data.find((t: Task) => t.status === "running" || t.status === "queued");
        if (active) setExpandedId(active.id);
        expandedOnceRef.current = true;
      }
    }
    setLoading(false);
  }, [buyerId]);

  // Advance pipeline for active tasks by calling /api/research/process
  const processActiveTasks = useCallback(async () => {
    const activeTasks = tasksRef.current.filter((t) => t.status === "running");
    for (const task of activeTasks) {
      if (task.output_data?.bu_task_id || task.output_data?.pipeline_stage === "scoring") {
        try {
          await fetch("/api/research/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: task.id }),
          });
        } catch {
          // Ignore — fetchTasks will pick up state changes
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Poll: advance pipeline + refresh from DB
  // Use a stable interval that doesn't depend on `tasks` state
  useEffect(() => {
    const interval = setInterval(async () => {
      const hasActive = tasksRef.current.some(
        (t) => t.status === "running" || t.status === "queued"
      );
      if (!hasActive) return;
      await processActiveTasks();
      await fetchTasks();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchTasks, processActiveTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading research tasks...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No research tasks yet. Click &quot;Run Research&quot; to start.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const isExpanded = expandedId === task.id;
        const isActive = task.status === "running" || task.status === "queued";
        const events = task.execution_log ?? [];
        const liveUrl = task.output_data?.live_url;
        const stageDesc = getStageDescription(task);

        return (
          <Card key={task.id} className={isActive ? "border-primary/30" : undefined}>
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
              >
                <div className="flex items-center gap-2">
                  {events.length > 0 || liveUrl ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )
                  ) : (
                    <div className="w-4" />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      {task.task_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(task.created_at).toLocaleString()}
                      {task.completed_at &&
                        ` · Completed ${new Date(task.completed_at).toLocaleString()}`}
                    </p>
                    {isActive && stageDesc && (
                      <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {stageDesc}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && !stageDesc && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                  <Badge
                    variant={
                      task.status === "completed"
                        ? "default"
                        : task.status === "running"
                          ? "secondary"
                          : task.status === "failed"
                            ? "destructive"
                            : "outline"
                    }
                  >
                    {task.status}
                  </Badge>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2">
                  {task.error_message && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 mb-2">
                      {task.error_message}
                    </p>
                  )}

                  {task.output_data?.error && !task.error_message && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 mb-2">
                      {task.output_data.error}
                    </p>
                  )}

                  {task.output_data && task.status === "completed" && (
                    <div className="flex gap-4 text-xs text-muted-foreground bg-muted rounded px-2 py-1.5 mb-2">
                      <span>{task.output_data.properties_found ?? 0} properties found</span>
                      <span>{task.output_data.properties_enriched ?? 0} enriched</span>
                      <span>{task.output_data.properties_scored ?? 0} scored</span>
                    </div>
                  )}

                  {/* Live browser preview — keep mounted even after task completes so iframe doesn't vanish */}
                  {liveUrl && (
                    <LivePreview key={task.id} liveUrl={liveUrl} />
                  )}

                  {events.length > 0 ? (
                    <TaskTimeline events={events} isRunning={isActive} />
                  ) : isActive ? (
                    <div className="ml-6 space-y-1">
                      {!liveUrl && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Starting research pipeline...
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
