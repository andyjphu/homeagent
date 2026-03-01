"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

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
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{emails.length} emails from the last 14 days</p>
        <Button variant="ghost" size="sm" onClick={fetchEmails}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>
      {emails.map((email) => {
        const isExpanded = expandedId === email.id;
        const fromName = email.from.replace(/<.*>/, "").trim() || email.from;
        return (
          <Card
            key={email.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setExpandedId(isExpanded ? null : email.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {email.direction}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {email.direction === "inbound" ? fromName : email.to}
                    </span>
                  </div>
                  <p className="font-medium truncate">
                    {email.subject || "(no subject)"}
                  </p>
                  {!isExpanded && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {email.snippet}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(email.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground space-y-1 mb-3">
                    <p>From: {email.from}</p>
                    <p>To: {email.to}</p>
                    <p>Date: {new Date(email.date).toLocaleString()}</p>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-muted p-3 rounded max-h-80 overflow-y-auto">
                    {email.body || "(no text content)"}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
