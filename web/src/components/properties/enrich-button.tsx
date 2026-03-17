"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

export function EnrichButton({ propertyId }: { propertyId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleEnrich() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/enrich`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Enrichment failed");
      }
    } catch {
      setError("Failed to connect to enrichment service");
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleEnrich} disabled={loading} size="sm" variant="outline">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1" />
        )}
        {loading ? "Enriching..." : "Enrich Property"}
      </Button>
      {error && (
        <span className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
