"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Pencil, Save, AlertTriangle } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [manualOffer, setManualOffer] = useState("");
  const [manualReasoning, setManualReasoning] = useState("");
  const [manualEscalation, setManualEscalation] = useState("");
  const router = useRouter();

  async function generateStrategy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deals/" + dealId + "/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, agentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ||
            (res.status === 503
              ? "AI not configured — set up API keys in Settings"
              : "Failed to generate strategy")
        );
      } else {
        router.refresh();
      }
    } catch (err) {
      setError("Failed to connect to strategy service");
      console.error("Failed to generate strategy:", err);
    }
    setLoading(false);
  }

  async function saveManualStrategy() {
    const offerNum = Number(manualOffer.replace(/[^0-9]/g, ""));
    if (!offerNum && !manualReasoning.trim()) return;

    setSavingManual(true);
    try {
      const res = await fetch("/api/deals/" + dealId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_strategy_brief: {
            recommended_offer: offerNum || null,
            reasoning: manualReasoning.trim() || null,
            escalation_path: manualEscalation.trim() || null,
            source: "manual",
          },
        }),
      });
      if (res.ok) {
        setManualMode(false);
        router.refresh();
      }
    } catch {
      // keep form open
    }
    setSavingManual(false);
  }

  // Empty state — no strategy yet
  if (!strategy || Object.keys(strategy).length === 0) {
    return (
      <Card>
        <CardContent className="py-8 space-y-4">
          {!manualMode ? (
            <div className="text-center">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Create an offer strategy brief with AI analysis or write your own.
              </p>

              {error && (
                <div className="mb-4 mx-auto max-w-md flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-2">
                <Button onClick={generateStrategy} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Generating..." : "Generate with AI"}
                </Button>
                <Button variant="outline" onClick={() => setManualMode(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Write Manually
                </Button>
              </div>
            </div>
          ) : (
            <ManualStrategyForm
              offer={manualOffer}
              setOffer={setManualOffer}
              reasoning={manualReasoning}
              setReasoning={setManualReasoning}
              escalation={manualEscalation}
              setEscalation={setManualEscalation}
              onSave={saveManualStrategy}
              onCancel={() => setManualMode(false)}
              saving={savingManual}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  // Strategy exists — display it
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
            {strategy.source === "manual" && (
              <span className="text-xs text-muted-foreground">Agent's strategy</span>
            )}
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

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Button variant="outline" onClick={generateStrategy} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Regenerate with AI
      </Button>
    </div>
  );
}

function ManualStrategyForm({
  offer,
  setOffer,
  reasoning,
  setReasoning,
  escalation,
  setEscalation,
  onSave,
  onCancel,
  saving,
}: {
  offer: string;
  setOffer: (v: string) => void;
  reasoning: string;
  setReasoning: (v: string) => void;
  escalation: string;
  setEscalation: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-sm">Write Your Offer Strategy</h3>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Recommended Opening Offer ($)</label>
        <Input
          placeholder="e.g. 425000"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Reasoning / Rationale</label>
        <Textarea
          placeholder="Why this offer amount? What comps support it? What's the seller's likely response?"
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          className="min-h-[80px]"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Escalation Path (optional)</label>
        <Textarea
          placeholder="If countered, how high will you go? What contingencies can you adjust?"
          value={escalation}
          onChange={(e) => setEscalation(e.target.value)}
          className="min-h-[60px]"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Strategy
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
