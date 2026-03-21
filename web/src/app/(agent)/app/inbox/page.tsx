"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Phone,
  MessageSquare,
  Pencil,
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
} from "lucide-react";

interface Buyer {
  id: string;
  full_name: string;
  email: string;
}

interface Communication {
  id: string;
  type: "email" | "call" | "sms" | "note";
  direction: "inbound" | "outbound";
  buyer_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
  subject: string | null;
  raw_content: string | null;
  from_address: string | null;
  to_address: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  classification: string | null;
  ai_analysis: Record<string, unknown> | null;
  gmail_message_id: string | null;
  is_processed: boolean;
  occurred_at: string;
  created_at: string;
  buyers: Buyer | null;
}

const TYPE_ICONS = {
  email: Mail,
  call: Phone,
  sms: MessageSquare,
  note: Pencil,
} as const;

const TYPE_COLORS = {
  email: "text-blue-500",
  call: "text-green-500",
  sms: "text-purple-500",
  note: "text-amber-500",
} as const;

const CLASSIFICATION_COLORS: Record<string, string> = {
  deal_relevant: "bg-green-100 text-green-700",
  new_lead: "bg-blue-100 text-blue-700",
  action_required: "bg-red-100 text-red-700",
  noise: "bg-gray-100 text-gray-500",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CommunicationCard({ comm }: { comm: Communication }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICONS[comm.type] || Mail;
  const iconColor = TYPE_COLORS[comm.type] || "text-gray-500";

  const buyerName = comm.buyers?.full_name;
  const summary = comm.subject || getSummary(comm);

  return (
    <Card
      className="cursor-pointer hover:bg-accent/30 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {buyerName && (
                <span className="text-sm font-medium">{buyerName}</span>
              )}
              {!buyerName && comm.from_address && (
                <span className="text-sm font-medium">{comm.from_address}</span>
              )}
              <Badge variant="outline" className="text-xs capitalize">
                {comm.type}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {comm.direction}
              </Badge>
              {comm.classification && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    CLASSIFICATION_COLORS[comm.classification] ??
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {comm.classification.replace(/_/g, " ")}
                </span>
              )}
              {comm.type === "call" && comm.duration_seconds != null && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(comm.duration_seconds)}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {summary}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {formatDate(comm.occurred_at)}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
            {/* Email body */}
            {comm.type === "email" && comm.raw_content && (
              <div className="text-sm whitespace-pre-wrap max-h-64 overflow-y-auto text-muted-foreground">
                {comm.raw_content}
              </div>
            )}

            {/* Call transcript */}
            {comm.type === "call" && (
              <div className="space-y-2">
                {comm.recording_url && (
                  <audio controls src={comm.recording_url} className="w-full h-8" />
                )}
                {comm.raw_content ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Transcript
                      {comm.ai_analysis?.source === "deepgram_nova3" && (
                        <span className="ml-1 text-green-600">(Deepgram Nova-3)</span>
                      )}
                    </p>
                    {renderTranscript(comm)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Transcription pending...
                  </p>
                )}
                {typeof comm.ai_analysis?.summary === "string" && (
                  <div className="bg-accent/50 rounded p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      AI Summary
                    </p>
                    <p className="text-sm">
                      {String(comm.ai_analysis.summary)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SMS */}
            {comm.type === "sms" && comm.raw_content && (
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                {comm.raw_content}
              </div>
            )}

            {/* Note */}
            {comm.type === "note" && comm.raw_content && (
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                {comm.raw_content}
              </div>
            )}

            {/* No content */}
            {!comm.raw_content && comm.type !== "call" && (
              <p className="text-sm text-muted-foreground italic">
                No content available
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function renderTranscript(comm: Communication) {
  const speakers = (comm.ai_analysis?.speakers as Array<{
    speaker: number;
    text: string;
    start: number;
    end: number;
  }>) || null;

  if (speakers && speakers.length > 0) {
    return (
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {speakers.map((seg, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium text-xs text-muted-foreground">
              Speaker {seg.speaker + 1}:
            </span>{" "}
            <span className="text-foreground">{seg.text}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-sm whitespace-pre-wrap max-h-64 overflow-y-auto text-muted-foreground">
      {comm.raw_content}
    </div>
  );
}

function getSummary(comm: Communication): string {
  if (comm.type === "call") {
    const dur = comm.duration_seconds
      ? ` (${formatDuration(comm.duration_seconds)})`
      : "";
    return `${comm.direction === "inbound" ? "Inbound" : "Outbound"} call${dur}`;
  }
  if (comm.raw_content) {
    return comm.raw_content.slice(0, 120) + (comm.raw_content.length > 120 ? "..." : "");
  }
  return "No content";
}

export default function InboxPage() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [buyerFilter, setBuyerFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (buyerFilter !== "all") params.set("buyer_id", buyerFilter);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    try {
      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCommunications(data.communications);
        setBuyers(data.buyers);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("[inbox] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, buyerFilter, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [typeFilter, buyerFilter]);

  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          Inbox
        </h1>
        <span className="text-sm text-muted-foreground">
          {total} {total === 1 ? "message" : "messages"}
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="call">Calls</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
          </SelectContent>
        </Select>

        <Select value={buyerFilter} onValueChange={setBuyerFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All buyers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buyers</SelectItem>
            {buyers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : communications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No communications yet</p>
          <p className="text-xs mt-1">
            Connect Gmail or receive a call to see messages here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {communications.map((comm) => (
            <CommunicationCard key={comm.id} comm={comm} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setOffset((o) => o + limit)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
