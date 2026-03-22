"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, AlertCircle, Loader2 } from "lucide-react";

interface RiskSignal {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  data: Record<string, unknown>;
}

export function DealRiskSignals({ dealId }: { dealId: string }) {
  const [signals, setSignals] = useState<RiskSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/deals/${dealId}/risks`);
        if (res.ok) {
          const data = await res.json();
          setSignals(data.signals ?? []);
        }
      } catch {
        // Silently fail — risk signals are optional
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking risk signals...
      </div>
    );
  }

  if (signals.length === 0) return null;

  return (
    <div className="space-y-2">
      {signals.map((signal, i) => (
        <div
          key={`${signal.type}-${i}`}
          className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${
            signal.severity === "critical"
              ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
              : signal.severity === "warning"
              ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
              : "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
          }`}
        >
          {signal.severity === "critical" ? (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : signal.severity === "warning" ? (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{signal.message}</span>
        </div>
      ))}
    </div>
  );
}
