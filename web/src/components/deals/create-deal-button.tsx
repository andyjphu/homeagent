"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Handshake, Loader2 } from "lucide-react";

export function CreateDealButton({
  buyerId,
  propertyId,
}: {
  buyerId: string;
  propertyId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function createDeal() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId, propertyId }),
      });

      const data = await res.json();

      if (res.status === 409 && data.dealId) {
        // Deal already exists, navigate to it
        router.push(`/deals/${data.dealId}`);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to create deal");
        return;
      }

      router.push(`/deals/${data.deal.id}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        onClick={createDeal}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Handshake className="h-3.5 w-3.5 mr-1" />
        )}
        Start Deal
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
