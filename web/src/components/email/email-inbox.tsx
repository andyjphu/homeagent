"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, RefreshCw } from "lucide-react";

interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  direction: "inbound" | "outbound";
  classification: string | null;
  aiAnalysis: { reasoning?: string } | null;
  buyerName: string | null;
}

const CLS_CONFIG: Record<string, { variant: "destructive" | "default" | "secondary" | "outline"; label: string; color: string }> = {
  new_lead: { variant: "destructive", label: "new lead", color: "#ef4444" },
  action_required: { variant: "default", label: "action required", color: "#f59e0b" },
  deal_relevant: { variant: "secondary", label: "deal relevant", color: "#3b82f6" },
  noise: { variant: "outline", label: "noise", color: "#9ca3af" },
};

function PieChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const size = 64;
  const radius = 28;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;

  const slices = data.filter(d => d.count > 0).map((d) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.count;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = d.count / total > 0.5 ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    // Full circle case
    if (data.filter(d => d.count > 0).length === 1) {
      return (
        <circle key={d.label} cx={cx} cy={cy} r={radius} fill={d.color} />
      );
    }

    return (
      <path
        key={d.label}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={d.color}
      />
    );
  });

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices}
      </svg>
      <div className="flex flex-col gap-0.5">
        {data.filter(d => d.count > 0).map((d) => (
          <div key={d.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-medium">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmailInbox() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/inbox");
      const data = await res.json();
      if (res.ok) {
        setEmails(data.emails);
      } else {
        setError(data.error || "Failed to fetch emails");
      }
    } catch {
      setError("Failed to fetch emails");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    const handler = () => fetchEmails();
    window.addEventListener("emails-updated", handler);
    return () => window.removeEventListener("emails-updated", handler);
  }, [fetchEmails]);

  const classifiedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of emails) {
      if (e.classification) {
        counts[e.classification] = (counts[e.classification] || 0) + 1;
      }
    }
    return counts;
  }, [emails]);

  const hasClassifications = Object.keys(classifiedCount).length > 0;

  const pieData = useMemo(() => {
    return Object.entries(CLS_CONFIG).map(([key, cfg]) => ({
      label: cfg.label,
      count: classifiedCount[key] || 0,
      color: cfg.color,
    }));
  }, [classifiedCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading emails...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchEmails}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No emails found in the last 14 days.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {hasClassifications && (
        <div className="flex items-center justify-between">
          <PieChart data={pieData} />
          <p className="text-xs text-muted-foreground">
            {Object.values(classifiedCount).reduce((a, b) => a + b, 0)} of {emails.length} classified
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">{emails.length} emails &middot; last 14 days</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchEmails}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
        <div className="border rounded-lg divide-y">
          {emails.map((email) => {
            const isExpanded = expandedId === email.id;
            const isNoise = email.classification === "noise";
            const fromName = email.from.replace(/<.*>/, "").trim() || email.from;
            const cls = email.classification ? CLS_CONFIG[email.classification] : null;
            const dateStr = new Date(email.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={email.id}
                className={`cursor-pointer transition-colors ${isNoise ? "opacity-40 hover:opacity-70" : "hover:bg-accent/50"}`}
                onClick={() => setExpandedId(isExpanded ? null : email.id)}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${email.direction === "inbound" ? "bg-blue-500" : "bg-emerald-500"}`} />
                  {cls && !isNoise && (
                    <Badge variant={cls.variant} className="text-[10px] px-1.5 py-0 shrink-0">
                      {cls.label}
                    </Badge>
                  )}
                  <span className="text-sm font-medium w-36 truncate shrink-0">
                    {email.direction === "inbound" ? fromName : email.to}
                  </span>
                  <span className="text-sm truncate flex-1 min-w-0">
                    <span className="font-medium">{email.subject || "(no subject)"}</span>
                    {!isExpanded && email.snippet && (
                      <span className="text-muted-foreground"> — {email.snippet}</span>
                    )}
                  </span>
                  {email.buyerName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {email.buyerName}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{dateStr}</span>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mb-2">
                      <span>From: {email.from}</span>
                      <span>To: {email.to}</span>
                      <span>{new Date(email.date).toLocaleString()}</span>
                    </div>
                    {email.aiAnalysis?.reasoning && (
                      <p className="text-xs text-muted-foreground bg-background border rounded px-2 py-1.5 mb-2">
                        AI: {email.aiAnalysis.reasoning}
                      </p>
                    )}
                    <pre className="text-sm whitespace-pre-wrap font-sans bg-background p-3 rounded border max-h-72 overflow-y-auto">
                      {email.body || "(no text content)"}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
