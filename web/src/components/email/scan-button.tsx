"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";

export function ScanButton() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleScan(rescan = false) {
    setScanning(true);
    setResult(null);
    try {
      const url = rescan ? "/api/email/scan?rescan=1" : "/api/email/scan";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        let msg = `Processed ${data.processed} of ${data.total} email(s)`;
        if (data.skipped) msg += ` (${data.skipped} already scanned)`;
        if (data.errors?.length) msg += ` — ${data.errors[0]}`;
        setResult(msg);
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
  }

  return (
    <div className="flex items-center gap-3">
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
      {result && (
        <span className="text-sm text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
