"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

export function OfferStrategyPanel({
  dealId,
  agentId,
  strategy,
}: {
  dealId: string;
  agentId: string;
  strategy: any;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function generateStrategy() {
    setLoading(true);
    try {
      await fetch("/api/deals/" + dealId + "/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, agentId }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to generate strategy:", err);
    }
    setLoading(false);
  }

  if (!strategy || Object.keys(strategy).length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Generate an AI-powered offer strategy brief based on property data,
            seller intelligence, comps, and listing agent profile.
          </p>
          <Button onClick={generateStrategy} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {loading ? "Generating..." : "Generate Strategy"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {strategy.recommended_offer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended Opening Offer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-2xl font-bold">
              ${strategy.recommended_offer.toLocaleString()}
            </p>
            {strategy.reasoning && <p>{strategy.reasoning}</p>}
          </CardContent>
        </Card>
      )}

      {strategy.escalation_path && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalation Path</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{strategy.escalation_path}</p>
          </CardContent>
        </Card>
      )}

      {strategy.fair_market_value && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fair Market Value Range</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              ${strategy.fair_market_value.low?.toLocaleString()} -{" "}
              ${strategy.fair_market_value.high?.toLocaleString()}
            </p>
            <p className="text-muted-foreground">
              Midpoint: ${strategy.fair_market_value.mid?.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}

      {strategy.listing_agent_analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing Agent Analysis</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{strategy.listing_agent_analysis}</p>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={generateStrategy} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Regenerate Strategy
      </Button>
    </div>
  );
}
