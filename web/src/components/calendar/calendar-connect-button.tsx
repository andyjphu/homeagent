"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2 } from "lucide-react";

export function CalendarConnectButton({
  isConnected,
}: {
  isConnected: boolean;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/calendar/disconnect", { method: "POST" });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error("Failed to disconnect Calendar:", err);
    }
    setDisconnecting(false);
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Connected
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Disconnect"
          )}
        </Button>
      </div>
    );
  }

  return (
    <a href="/api/calendar/connect">
      <Button size="sm">Connect Calendar</Button>
    </a>
  );
}
