"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function FUBConnectButton({
  isConnected,
  lastSyncAt,
}: {
  isConnected: boolean;
  lastSyncAt: string | null;
}) {
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleConnect() {
    if (!apiKey.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/followupboss/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (res.ok) {
        setShowInput(false);
        setApiKey("");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Connection failed");
      }
    } catch {
      setError("Connection failed");
    }
    setConnecting(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/followupboss/disconnect", {
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
      const res = await fetch("/api/integrations/followupboss/sync", {
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

  if (showInput) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            type="password"
            placeholder="Paste your FUB API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-8 text-sm w-48"
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={connecting || !apiKey.trim()}
          >
            {connecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowInput(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => setShowInput(true)}>
      Connect
    </Button>
  );
}
