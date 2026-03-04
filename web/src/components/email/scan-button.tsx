"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, RotateCcw, Clock } from "lucide-react";

interface ScanButtonProps {
  lastScanAt?: string | null;
}

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

export function ScanButton({ lastScanAt }: ScanButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(lastScanAt ?? null);
  const scanInFlight = useRef(false);
  const router = useRouter();

  // Fetch last scan timestamp on mount
  const fetchLastScan = useCallback(async () => {
    try {
      const res = await fetch("/api/email/scan-status");
      if (res.ok) {
        const data = await res.json();
        if (data.lastScanAt) setLastScan(data.lastScanAt);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (!lastScanAt) fetchLastScan();
  }, [lastScanAt, fetchLastScan]);

  async function handleScan(rescan = false) {
    // Prevent double-click: if already scanning, bail
    if (scanInFlight.current) return;
    scanInFlight.current = true;
    setScanning(true);
    setResult(null);
    window.dispatchEvent(new Event("scan-started"));
    try {
      const url = rescan ? "/api/email/scan?rescan=1" : "/api/email/scan";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        let msg = `Processed ${data.processed} of ${data.total} email(s)`;
        if (data.skipped) msg += ` (${data.skipped} already scanned)`;
        if (!data.usedLLM) msg += " (keyword mode)";
        if (data.errors?.length) msg += ` — ${data.errors[0]}`;
        setResult(msg);
        setLastScan(new Date().toISOString());
        window.dispatchEvent(new Event("emails-updated"));
        router.refresh();
      } else {
        setResult(data.error || "Scan failed");
      }
    } catch (err) {
      console.error("Scan failed:", err);
      setResult("Scan failed");
    }
    setScanning(false);
    scanInFlight.current = false;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleScan(false)}
        disabled={scanning}
      >
        {scanning ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1" />
        )}
        {scanning ? "Scanning..." : "Scan New"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleScan(true)}
        disabled={scanning}
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        Re-scan All
      </Button>
      {lastScan && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last scan: {formatRelativeTime(lastScan)}
        </span>
      )}
      {result && (
        <span className="text-sm text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
