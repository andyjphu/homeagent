"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { ComposeModal } from "@/components/email/compose-modal";

export function EmailSummaryButton({ buyerId }: { buyerId: string }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/buyer-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraft(data);
      }
    } catch {
      // silent
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Mail className="h-4 w-4 mr-1" />
        )}
        Email Summary
      </Button>
      {draft && (
        <ComposeModal
          open={!!draft}
          onOpenChange={(open) => { if (!open) setDraft(null); }}
          initialTo={draft.to}
          initialSubject={draft.subject}
          initialBody={draft.body}
        />
      )}
    </>
  );
}
