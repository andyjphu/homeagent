"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Phone,
  FileAudio,
  Loader2,
  ChevronRight,
  Bot,
} from "lucide-react";
import { CallDetailView } from "./call-detail-view";

interface CallRecord {
  id: string;
  direction: string;
  from_address: string | null;
  subject: string | null;
  raw_content: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  ai_analysis: Record<string, unknown>;
  is_processed: boolean;
  lead_id: string | null;
  buyer_id: string | null;
  occurred_at: string;
  buyers?: { full_name: string } | null;
}

export function CallList({ calls }: { calls: CallRecord[] }) {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  if (!calls || calls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No calls logged yet. Upload a recording or log a call to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {calls.map((call) => {
          const analysis = (call.ai_analysis || {}) as Record<string, unknown>;
          const extraction = analysis.extraction as Record<string, unknown> | undefined;
          const summary =
            (extraction?.summary as string) ||
            (analysis.summary as string) ||
            null;
          const callerName =
            (extraction?.caller_name as string) ||
            (analysis.caller_name as string) ||
            call.buyers?.full_name ||
            null;
          const status = analysis.status as string | undefined;
          const source = analysis.source as string | undefined;
          const urgency = extraction?.urgency as string | undefined;
          const buyerTemp = analysis.buyer_temperature as string | undefined;

          const isProcessing = status === "processing" || status === "transcribed";

          return (
            <Card
              key={call.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedCall(call)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {source === "ai_voice_agent" ? (
                        <Bot className="h-4 w-4 text-violet-500 flex-shrink-0" />
                      ) : call.recording_url ? (
                        <FileAudio className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">
                        {call.subject || (callerName ? `Call with ${callerName}` : "Call logged")}
                      </span>
                      {source === "ai_voice_agent" ? (
                        <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100">
                          <Bot className="h-3 w-3 mr-1" />
                          AI Receptionist
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {source === "upload"
                            ? "Uploaded"
                            : source === "manual"
                              ? "Manual"
                              : call.direction}
                        </Badge>
                      )}
                      {isProcessing && (
                        <Badge variant="outline" className="text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Processing
                        </Badge>
                      )}
                      {urgency === "high" && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                      {buyerTemp && (
                        <Badge
                          variant={
                            buyerTemp === "hot"
                              ? "destructive"
                              : buyerTemp === "warm"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {buyerTemp}
                        </Badge>
                      )}
                      {call.lead_id && (
                        <Badge variant="secondary" className="text-xs">
                          Lead
                        </Badge>
                      )}
                    </div>
                    {call.duration_seconds != null && call.duration_seconds > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                      </p>
                    )}
                    {summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(call.occurred_at)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Call detail dialog */}
      <Dialog
        open={!!selectedCall}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedCall(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedCall && (
            <CallDetailView
              call={selectedCall as Parameters<typeof CallDetailView>[0]["call"]}
              onClose={() => setSelectedCall(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
