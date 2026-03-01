"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, RefreshCw } from "lucide-react";

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  direction: "inbound" | "outbound";
}

export function EmailInbox() {
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchEmails() {
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
  }

  useEffect(() => {
    fetchEmails();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading emails from Gmail...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchEmails}>
            <RefreshCw className="h-4 w-4 mr-1" />
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
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No emails found in the last 14 days.</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
          const fromName = email.from.replace(/<.*>/, "").trim() || email.from;
          const dateStr = new Date(email.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          return (
            <div
              key={email.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : email.id)}
            >
              <div className="flex items-center gap-3 px-3 py-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${email.direction === "inbound" ? "bg-blue-500" : "bg-emerald-500"}`} />
                <span className="text-sm font-medium w-40 truncate shrink-0">
                  {email.direction === "inbound" ? fromName : email.to}
                </span>
                <span className="text-sm truncate flex-1">
                  <span className="font-medium">{email.subject || "(no subject)"}</span>
                  {!isExpanded && email.snippet && (
                    <span className="text-muted-foreground"> — {email.snippet}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{dateStr}</span>
              </div>
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                  <div className="text-xs text-muted-foreground flex gap-4 mb-2">
                    <span>From: {email.from}</span>
                    <span>To: {email.to}</span>
                    <span>{new Date(email.date).toLocaleString()}</span>
                  </div>
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
  );
}
