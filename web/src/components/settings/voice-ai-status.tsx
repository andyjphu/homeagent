"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Bot,
  Clock,
  Loader2,
  CheckCircle2,
  User,
} from "lucide-react";

interface RecentCall {
  id: string;
  callerPhone: string | null;
  callerName: string | null;
  durationSeconds: number | null;
  occurredAt: string;
  confidence: string | null;
  hasLead: boolean;
  platform: string | null;
}

interface VoiceAgentStatus {
  connected: boolean;
  platform: string | null;
  phoneNumber: string | null;
  recentCalls: RecentCall[];
}

export function VoiceAiStatus() {
  const [status, setStatus] = useState<VoiceAgentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/voice-agent")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading voice AI status...
      </div>
    );
  }

  if (!status?.connected) return null;

  return (
    <div className="space-y-3">
      {status.phoneNumber && (
        <>
          <Separator />
          <div className="rounded-lg border p-3 bg-violet-50/50">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium">AI Phone Number</span>
            </div>
            <p className="text-lg font-mono font-semibold text-violet-700">
              {formatPhoneNumber(status.phoneNumber)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Forward your cell to this number when busy or after hours.
              The AI will qualify leads and add them to your dashboard.
            </p>
          </div>
        </>
      )}

      {status.recentCalls.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Recent AI Calls
            </p>
            <div className="space-y-2">
              {status.recentCalls.slice(0, 5).map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between text-sm p-2 rounded border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-xs truncate">
                        {call.callerName || call.callerPhone || "Unknown"}
                      </p>
                      {call.callerPhone && call.callerName && (
                        <p className="text-xs text-muted-foreground">
                          {call.callerPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {call.durationSeconds != null && call.durationSeconds > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {Math.floor(call.durationSeconds / 60)}m{" "}
                        {call.durationSeconds % 60}s
                      </span>
                    )}
                    {call.hasLead && (
                      <Badge variant="secondary" className="text-xs">
                        <User className="h-3 w-3 mr-0.5" />
                        Lead
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(call.occurredAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatPhoneNumber(phone: string): string {
  // Format E.164 to readable: +15551234567 → (555) 123-4567
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const area = cleaned.slice(1, 4);
    const prefix = cleaned.slice(4, 7);
    const line = cleaned.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  return phone;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
