"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageSquare, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function BuyerPropertyCard({
  score,
  property,
  rank,
  comments,
  buyerId,
  dashboardToken,
}: {
  score: any;
  property: any;
  rank: number;
  comments: any[];
  buyerId: string;
  dashboardToken: string;
}) {
  const [isFavorited, setIsFavorited] = useState(score.is_favorited);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [localComments, setLocalComments] = useState(comments);
  const [submitting, setSubmitting] = useState(false);

  async function toggleFavorite() {
    const newValue = !isFavorited;
    setIsFavorited(newValue);

    await fetch(`/api/dashboard/${dashboardToken}/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerId,
        propertyId: property.id,
        scoreId: score.id,
        isFavorited: newValue,
      }),
    });
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);

    const response = await fetch(`/api/dashboard/${dashboardToken}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerId,
        propertyId: property.id,
        content: newComment.trim(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      setLocalComments([data.comment, ...localComments]);
      setNewComment("");
    }
    setSubmitting(false);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <div className="text-center shrink-0">
            <div className="text-2xl font-bold text-primary">#{rank}</div>
            <div className="text-3xl font-bold">{score.match_score}</div>
            <p className="text-xs text-muted-foreground">match</p>
          </div>

          {/* Property info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{property.address}</h3>
                <p className="text-muted-foreground">
                  {property.city}, {property.state} {property.zip}
                </p>
              </div>
              <p className="text-xl font-bold">
                ${property.listing_price?.toLocaleString()}
              </p>
            </div>

            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{property.beds} bed</span>
              <span>{property.baths} bath</span>
              <span>{property.sqft?.toLocaleString()} sqft</span>
              {property.year_built && <span>Built {property.year_built}</span>}
              {property.hoa_monthly && (
                <span>${property.hoa_monthly}/mo HOA</span>
              )}
            </div>

            {/* Score reasoning */}
            {score.score_reasoning && (
              <p className="text-sm bg-muted p-3 rounded-lg">
                {score.score_reasoning}
              </p>
            )}

            {/* Additional data */}
            <div className="flex flex-wrap gap-2">
              {property.walk_score && (
                <Badge variant="outline">Walk: {property.walk_score}</Badge>
              )}
              {property.days_on_market && (
                <Badge variant="outline">{property.days_on_market} DOM</Badge>
              )}
              {property.seller_motivation_score && (
                <Badge variant="secondary">
                  Seller motivation: {property.seller_motivation_score}/100
                </Badge>
              )}
            </div>

            {/* School ratings */}
            {property.school_ratings &&
              Object.keys(property.school_ratings).length > 0 && (
                <div className="flex gap-2 text-xs">
                  {Object.entries(property.school_ratings as any).map(
                    ([type, data]: [string, any]) =>
                      data?.rating && (
                        <Badge key={type} variant="outline">
                          {type}: {data.name} ({data.rating}/10)
                        </Badge>
                      )
                  )}
                </div>
              )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant={isFavorited ? "default" : "outline"}
                size="sm"
                onClick={toggleFavorite}
              >
                <Heart
                  className={`h-4 w-4 mr-1 ${
                    isFavorited ? "fill-current" : ""
                  }`}
                />
                {isFavorited ? "Favorited" : "Favorite"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Comments ({localComments.length})
              </Button>
            </div>

            {/* Comments section */}
            {showComments && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Love the backyard! Worried about the busy road..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={submitComment}
                    disabled={submitting || !newComment.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {localComments.map((comment: any) => (
                  <div
                    key={comment.id}
                    className="bg-muted p-2 rounded text-sm"
                  >
                    <p>{comment.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
