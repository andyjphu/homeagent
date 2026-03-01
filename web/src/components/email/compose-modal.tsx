"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Check } from "lucide-react";

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  threadId?: string;
  inReplyTo?: string;
}

export function ComposeModal({
  open,
  onOpenChange,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  threadId,
  inReplyTo,
}: ComposeModalProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields when initial values change (e.g. opening for a new reply)
  useEffect(() => {
    if (open) {
      setTo(initialTo);
      setSubject(initialSubject);
      setBody(initialBody);
      setSent(false);
      setError(null);
    }
  }, [open, initialTo, initialSubject, initialBody]);

  const handleSend = async () => {
    if (!to || !subject || !body) {
      setError("All fields are required");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, threadId, inReplyTo }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send");
        setSending(false);
        return;
      }

      setSent(true);
      setTimeout(() => {
        onOpenChange(false);
        window.dispatchEvent(new Event("emails-updated"));
      }, 1200);
    } catch {
      setError("Failed to send email");
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {inReplyTo ? "Reply" : "Compose Email"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              rows={12}
              className="font-sans text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || sent}
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : sent ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              {sent ? "Sent" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
