"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Loader2, RefreshCw, Clock, CheckCircle } from "lucide-react";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DashboardScanBarProps {
  gmailConnected: boolean;
  lastScanAt: string | null;
}

export function DashboardScanBar({
  gmailConnected,
  lastScanAt,
}: DashboardScanBarProps) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(lastScanAt);
  const scanInFlight = useRef(false);

  if (!gmailConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Mail className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Connect Gmail to detect leads from your inbox
                </p>
                <p className="text-xs text-muted-foreground">
                  FoyerFind scans your email for buying-intent messages and
                  surfaces them as leads
                </p>
              </div>
            </div>
            <a href="/api/email/connect">
              <Button size="sm">Connect Gmail</Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handleScan() {
    if (scanInFlight.current) return;
    scanInFlight.current = true;
    setScanning(true);
    setResult(null);

    try {
      const res = await fetch("/api/email/scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        let msg = `Processed ${data.processed} of ${data.total} email(s)`;
        if (data.skipped) msg += ` (${data.skipped} already scanned)`;
        if (!data.usedLLM) msg += " (keyword mode)";
        if (data.errors?.length) msg += ` — ${data.errors[0]}`;
        setResult(msg);
        setLastScan(new Date().toISOString());
        router.refresh();
      } else {
        setResult(data.error || "Scan failed");
      }
    } catch {
      setResult("Scan failed");
    }
    setScanning(false);
    scanInFlight.current = false;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          <CheckCircle className="h-3 w-3 text-green-500" />
          Gmail Connected
        </Badge>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleScan}
        disabled={scanning}
      >
        {scanning ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1" />
        )}
        {scanning ? "Scanning last 14 days..." : "Scan Gmail"}
      </Button>
      {lastScan && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last scan: {formatRelativeTime(lastScan)}
        </span>
      )}
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
