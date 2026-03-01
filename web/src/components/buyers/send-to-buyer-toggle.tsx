"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Check, Loader2 } from "lucide-react";

export function SendToBuyerToggle({
  scoreId,
  initialSent,
}: {
  scoreId: string;
  initialSent: boolean;
}) {
  const [sent, setSent] = useState(initialSent);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/buyers/send-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreId, sent: !sent }),
      });
      if (res.ok) setSent(!sent);
    } catch {
      // silent
    }
    setLoading(false);
  };

  return (
    <Button
      variant={sent ? "default" : "outline"}
      size="sm"
      className="text-xs h-7 mt-1"
      onClick={toggle}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : sent ? (
        <Check className="h-3 w-3 mr-1" />
      ) : (
        <Send className="h-3 w-3 mr-1" />
      )}
      {sent ? "Sent" : "Send to Buyer"}
    </Button>
  );
}
