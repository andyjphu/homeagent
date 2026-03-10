"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  MapPin,
  Sparkles,
  Pencil,
  Check,
  X,
  Loader2,
  Zap,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import { SendToBuyerToggle } from "./send-to-buyer-toggle";
import { EnrichmentBadges } from "@/components/enrichment/enrichment-badges";
import { toast } from "sonner";

interface PropertyScoreCardProps {
  score: {
    id: string;
    match_score: number;
    score_reasoning: string | null;
    score_breakdown: Record<string, unknown> | null;
    agent_notes: string | null;
    is_favorited: boolean;
    is_sent_to_buyer: boolean;
    properties: {
      id: string;
      address: string;
      city: string | null;
      state: string | null;
      zip: string | null;
      listing_price: number | null;
      beds: number | null;
      baths: number | null;
      sqft: number | null;
      zillow_url: string | null;
      walk_score?: number | null;
      transit_score?: number | null;
      enrichment_data?: unknown;
    } | null;
  };
  buyerId: string;
  hasIntakeProfile: boolean;
}

export function PropertyScoreCard({
  score,
  buyerId,
  hasIntakeProfile,
}: PropertyScoreCardProps) {
  const prop = score.properties;
  const isAiScored =
    score.score_breakdown &&
    typeof score.score_breakdown === "object" &&
    (score.score_breakdown.source === "ai" ||
      (!score.score_breakdown.source && "price_fit" in score.score_breakdown));

  const [editing, setEditing] = useState(false);
  const [editScore, setEditScore] = useState(String(score.match_score));
  const [editReasoning, setEditReasoning] = useState(
    score.score_reasoning || ""
  );
  const [saving, setSaving] = useState(false);

  const [currentScore, setCurrentScore] = useState(score.match_score);
  const [currentReasoning, setCurrentReasoning] = useState(
    score.score_reasoning
  );
  const [currentIsAi, setCurrentIsAi] = useState(isAiScored);

  const [scoring, setScoring] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<unknown>(
    prop?.enrichment_data ?? null
  );

  const handleSaveOverride = async () => {
    const numScore = Number(editScore);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) return;

    setSaving(true);
    try {
      const res = await fetch("/api/properties/score/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreId: score.id,
          matchScore: numScore,
          scoreReasoning: editReasoning.trim() || null,
        }),
      });
      if (res.ok) {
        setCurrentScore(numScore);
        setCurrentReasoning(editReasoning.trim() || null);
        setCurrentIsAi(false);
        setEditing(false);
      }
    } catch {
      // silent
    }
    setSaving(false);
  };

  const handleRunScoring = async () => {
    if (!prop) return;
    setScoring(true);
    try {
      const res = await fetch("/api/properties/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          propertyIds: [prop.id],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newScore = data.scores?.[0];
        if (newScore) {
          setCurrentScore(newScore.match_score);
          setCurrentReasoning(newScore.score_reasoning);
          setCurrentIsAi(true);
        }
      }
    } catch {
      // silent
    }
    setScoring(false);
  };

  const handleEnrich = async () => {
    if (!prop) return;
    setEnriching(true);
    try {
      const res = await fetch(`/api/properties/${prop.id}/enrich`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setEnrichmentData(data.enrichment);
        toast.success("Property enriched with neighborhood data");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Enrichment failed");
      }
    } catch {
      toast.error("Enrichment failed — please try again.");
    }
    setEnriching(false);
  };

  if (!prop) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/properties/${prop.id}`}
                className="hover:underline"
              >
                <h3 className="font-medium">{prop.address}</h3>
              </Link>
              {score.is_favorited && (
                <Badge variant="destructive">Favorited</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              ${prop.listing_price?.toLocaleString()} &middot; {prop.beds} bed /{" "}
              {prop.baths} bath &middot; {prop.sqft?.toLocaleString()} sqft
            </p>
            {(prop.city || prop.state) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[prop.city, prop.state, prop.zip].filter(Boolean).join(", ")}
              </p>
            )}

            {/* Enrichment badges */}
            <div className="mt-1">
              <EnrichmentBadges
                enrichmentData={enrichmentData}
                walkScore={prop.walk_score}
                transitScore={prop.transit_score}
              />
            </div>

            {/* Score reasoning */}
            {currentReasoning && !editing && (
              <div className="mt-1">
                {currentIsAi && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mb-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI-suggested
                  </span>
                )}
                <p className="text-xs text-muted-foreground italic">
                  {currentReasoning}
                </p>
              </div>
            )}

            {/* Agent notes */}
            {score.agent_notes && (
              <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">
                Agent note: {score.agent_notes}
              </p>
            )}

            {/* Edit form */}
            {editing && (
              <div className="mt-2 space-y-2 border rounded p-2 bg-muted/50">
                <div className="flex items-center gap-2">
                  <label className="text-xs shrink-0">Score (0-100):</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                    className="h-7 w-20 text-sm"
                  />
                </div>
                <Textarea
                  value={editReasoning}
                  onChange={(e) => setEditReasoning(e.target.value)}
                  placeholder="Your reasoning..."
                  className="text-xs min-h-[50px] resize-y"
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-6 text-xs"
                    onClick={handleSaveOverride}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setEditing(false)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1">
              {prop.zillow_url && (
                <a
                  href={prop.zillow_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Listing <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="text-right flex flex-col items-end shrink-0 ml-4">
            <div className="text-2xl font-bold text-primary">
              {currentScore}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentIsAi ? "AI score" : "match score"}
            </p>

            <div className="flex gap-1 mt-1">
              {/* Override button */}
              {!editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1.5"
                  onClick={() => {
                    setEditScore(String(currentScore));
                    setEditReasoning(currentReasoning || "");
                    setEditing(true);
                  }}
                  title="Override score"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}

              {/* Run AI scoring button */}
              {hasIntakeProfile && !editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1.5"
                  onClick={handleRunScoring}
                  disabled={scoring}
                  title="Run AI scoring"
                >
                  {scoring ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                </Button>
              )}

              {/* Enrich button */}
              {!editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1.5"
                  onClick={handleEnrich}
                  disabled={enriching}
                  title="Enrich with neighborhood data"
                >
                  {enriching ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FlaskConical className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>

            <SendToBuyerToggle
              scoreId={score.id}
              initialSent={score.is_sent_to_buyer}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
