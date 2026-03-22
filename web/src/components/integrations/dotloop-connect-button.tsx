"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function DotloopConnectButton({
  isConnected,
  lastSyncAt,
}: {
  isConnected: boolean;
  lastSyncAt: string | null;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/dotloop/disconnect", {
        method: "POST",
      });
      if (res.ok) router.refresh();
    } catch {
      // ignore
    }
    setDisconnecting(false);
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/dotloop/sync", {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Sync failed");
      }
    } catch {
      setError("Sync failed");
    }
    setSyncing(false);
  }

  if (isConnected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Syncing...
              </>
            ) : (
              "Sync now"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-muted-foreground"
          >
            {disconnecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Disconnect"
            )}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <a href="/api/integrations/dotloop/connect">
      <Button size="sm">Connect</Button>
    </a>
  );
}
