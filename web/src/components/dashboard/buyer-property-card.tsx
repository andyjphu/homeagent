"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Camera,
  Car,
  Train,
  Bike,
  Footprints,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

function ScoreBar({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor =
    value >= 70
      ? "bg-green-500"
      : value >= 40
        ? "bg-yellow-500"
        : "bg-orange-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function schoolDotColor(rating: number) {
  if (rating >= 8) return "bg-green-500";
  if (rating >= 5) return "bg-yellow-500";
  return "bg-red-500";
}

export function BuyerPropertyCard({
  score,
  property,
  rank,
  comments,
  dashboardToken,
  isCompareSelected,
  onCompareToggle,
}: {
  score: any;
  property: any;
  rank: number;
  comments: any[];
  dashboardToken: string;
  isCompareSelected: boolean;
  onCompareToggle: () => void;
}) {
  const [isFavorited, setIsFavorited] = useState(score.is_favorited);
  const [showComments, setShowComments] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [localComments, setLocalComments] = useState(comments);
  const [submitting, setSubmitting] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [tracked, setTracked] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const photos: string[] = Array.isArray(property.photos)
    ? property.photos
    : [];
  const matchScore: number = score.match_score ?? 0;

  // Track view via IntersectionObserver — fire once per session per property
  useEffect(() => {
    if (tracked) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTracked(true);
          fetch(`/api/dashboard/${dashboardToken}/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              propertyId: property.id,
              action: "view",
            }),
          }).catch(() => {});
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tracked, dashboardToken, property.id]);

  const handleToggleDetails = useCallback(() => {
    const next = !showDetails;
    setShowDetails(next);
    if (next) {
      fetch(`/api/dashboard/${dashboardToken}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          action: "click",
        }),
      }).catch(() => {});
    }
  }, [showDetails, dashboardToken, property.id]);

  async function toggleFavorite() {
    const newValue = !isFavorited;
    setIsFavorited(newValue);

    try {
      const res = await fetch(`/api/dashboard/${dashboardToken}/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreId: score.id,
          isFavorited: newValue,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success(newValue ? "Added to favorites" : "Removed from favorites");
    } catch {
      setIsFavorited(!newValue);
      toast.error("Couldn't update favorite. Please try again.");
    }
  }

  async function submitComment() {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast.error("Comment is too long (max 2,000 characters)");
      return;
    }
    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/dashboard/${dashboardToken}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: property.id,
            content: trimmed,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLocalComments([data.comment, ...localComments]);
        setNewComment("");
        toast.success("Comment sent to your agent");
      } else {
        toast.error("Failed to submit comment");
      }
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    }
    setSubmitting(false);
  }

  // Score colors
  const scoreColor =
    matchScore >= 80
      ? "text-green-600"
      : matchScore >= 60
        ? "text-yellow-500"
        : matchScore >= 40
          ? "text-orange-500"
          : "text-red-500";
  const scoreStroke =
    matchScore >= 80
      ? "stroke-green-600"
      : matchScore >= 60
        ? "stroke-yellow-500"
        : matchScore >= 40
          ? "stroke-orange-500"
          : "stroke-red-500";

  const amenities: string[] = Array.isArray(property.amenities)
    ? property.amenities
    : [];
  const priceHistory: any[] = Array.isArray(property.price_history)
    ? property.price_history
    : [];
  const schoolRatings =
    property.school_ratings &&
    typeof property.school_ratings === "object" &&
    !Array.isArray(property.school_ratings)
      ? (property.school_ratings as Record<string, any>)
      : {};
  const commuteData =
    property.commute_data &&
    typeof property.commute_data === "object" &&
    !Array.isArray(property.commute_data)
      ? (property.commute_data as Record<string, any>)
      : null;

  return (
    <>
      <Card
        ref={cardRef}
        className={`overflow-hidden transition-all ${
          isCompareSelected ? "ring-2 ring-primary shadow-md" : ""
        }`}
      >
        {/* Hero image */}
        {photos.length > 0 ? (
          <div
            className="relative aspect-video cursor-pointer group"
            onClick={() => {
              setGalleryIndex(0);
              setGalleryOpen(true);
            }}
          >
            <img
              src={photos[0]}
              alt={property.address}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            {photos.length > 1 && (
              <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0 text-xs">
                <Camera className="h-3 w-3 mr-1" />
                1/{photos.length}
              </Badge>
            )}
            {/* Rank badge */}
            <div className="absolute top-3 left-3 bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold shadow-lg">
              #{rank}
            </div>
          </div>
        ) : (
          <div className="relative aspect-video bg-muted flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
            <div className="absolute top-3 left-3 bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold shadow-lg">
              #{rank}
            </div>
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          {/* Top row: score circle + address + price */}
          <div className="flex items-start gap-3">
            {/* Score circle (SVG ring) */}
            <div className="shrink-0 flex flex-col items-center w-14">
              <div className="relative h-12 w-12">
                <svg
                  className="-rotate-90 h-12 w-12"
                  viewBox="0 0 36 36"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${(matchScore / 100) * 97.4} 97.4`}
                    className={scoreStroke}
                  />
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor}`}
                >
                  {matchScore}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                AI match
              </span>
            </div>

            {/* Address + price + details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg leading-tight truncate">
                    {property.address}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {property.city}, {property.state} {property.zip}
                  </p>
                </div>
                <p className="text-xl font-bold whitespace-nowrap">
                  {property.listing_price != null
                    ? `$${property.listing_price.toLocaleString()}`
                    : "Price TBD"}
                </p>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground mt-1">
                {property.beds != null && <span>{property.beds} bed</span>}
                {property.baths != null && (
                  <span>{property.baths} bath</span>
                )}
                {property.sqft != null && (
                  <span>{property.sqft.toLocaleString()} sqft</span>
                )}
                {property.property_type && (
                  <span className="capitalize">{property.property_type}</span>
                )}
                {property.year_built && (
                  <span>Built {property.year_built}</span>
                )}
                {property.hoa_monthly != null && (
                  <span>${property.hoa_monthly}/mo HOA</span>
                )}
              </div>
            </div>
          </div>

          {/* Score reasoning */}
          {score.score_reasoning && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {score.score_breakdown?.source === "manual" ? "Agent analysis" : "AI-suggested analysis"}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {score.score_reasoning}
              </p>
            </div>
          )}

          {/* Agent notes callout */}
          {score.agent_notes && (
            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <p className="text-xs font-medium text-primary mb-1">
                Your agent&apos;s notes
              </p>
              <p className="text-sm">{score.agent_notes}</p>
            </div>
          )}

          {/* Quick badges */}
          <div className="flex flex-wrap gap-1.5">
            {property.listing_status && property.listing_status !== "active" && (
              <Badge
                variant={property.listing_status === "pending" ? "default" : "secondary"}
                className="text-xs capitalize"
              >
                {property.listing_status}
              </Badge>
            )}
            {property.walk_score != null && (
              <Badge variant="outline" className="text-xs">
                <Footprints className="h-3 w-3 mr-1" />
                Walk: {property.walk_score}
              </Badge>
            )}
            {property.transit_score != null && (
              <Badge variant="outline" className="text-xs">
                <Train className="h-3 w-3 mr-1" />
                Transit: {property.transit_score}
              </Badge>
            )}
            {property.days_on_market != null && (
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {property.days_on_market} DOM
              </Badge>
            )}
            {property.seller_motivation_score != null && (
              <Badge variant="secondary" className="text-xs">
                Seller motivation: {property.seller_motivation_score}/100
              </Badge>
            )}
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={isFavorited ? "default" : "outline"}
              size="sm"
              onClick={toggleFavorite}
            >
              <Heart
                className={`h-4 w-4 mr-1 ${isFavorited ? "fill-current" : ""}`}
              />
              {isFavorited ? "Favorited" : "Favorite"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              {localComments.length}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleDetails}
            >
              {showDetails ? (
                <ChevronUp className="h-4 w-4 mr-1" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-1" />
              )}
              {showDetails ? "Less" : "Details"}
            </Button>
            <button
              onClick={onCompareToggle}
              className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                isCompareSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              }`}
            >
              {isCompareSelected && <Check className="h-3 w-3" />}
              Compare
            </button>
          </div>

          {/* Expandable details */}
          {showDetails && (
            <div className="space-y-4 pt-3 border-t animate-in fade-in-0 slide-in-from-top-2 duration-200">
              {/* Score breakdown */}
              {score.score_breakdown &&
                typeof score.score_breakdown === "object" &&
                !Array.isArray(score.score_breakdown) &&
                Object.keys(score.score_breakdown).filter(k => k !== "source").length > 0 &&
                score.score_breakdown.source !== "manual" && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      AI-suggested match breakdown
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(
                        score.score_breakdown as Record<string, number>
                      ).map(
                        ([key, val]) =>
                          key !== "source" && typeof val === "number" && (
                            <ScoreBar
                              key={key}
                              label={key
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                              value={val}
                            />
                          )
                      )}
                    </div>
                  </div>
                )}

              {/* Description */}
              {property.listing_description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm leading-relaxed">
                    {property.listing_description}
                  </p>
                </div>
              )}

              {/* Amenities */}
              {amenities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Amenities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {amenities.map((a, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Walk / Transit scores */}
              {(property.walk_score != null ||
                property.transit_score != null) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Walkability & Transit
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {property.walk_score != null && (
                      <ScoreBar
                        label="Walk Score"
                        value={property.walk_score}
                      />
                    )}
                    {property.transit_score != null && (
                      <ScoreBar
                        label="Transit Score"
                        value={property.transit_score}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* School ratings */}
              {Object.keys(schoolRatings).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    School Ratings
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(schoolRatings).map(
                      ([type, data]: [string, any]) =>
                        data?.rating != null ? (
                          <div
                            key={type}
                            className="flex items-center gap-2 text-sm"
                          >
                            <div
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${schoolDotColor(
                                data.rating
                              )}`}
                            />
                            <span className="capitalize text-muted-foreground">
                              {type}:
                            </span>
                            <span className="font-medium">
                              {data.name}
                            </span>
                            <span className="text-muted-foreground">
                              ({data.rating}/10)
                            </span>
                          </div>
                        ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Commute data */}
              {commuteData && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Commute
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {commuteData.drive_minutes != null && (
                      <span className="flex items-center gap-1">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                        {commuteData.drive_minutes} min drive
                      </span>
                    )}
                    {commuteData.transit_minutes != null && (
                      <span className="flex items-center gap-1">
                        <Train className="h-3.5 w-3.5 text-muted-foreground" />
                        {commuteData.transit_minutes} min transit
                      </span>
                    )}
                    {commuteData.bike_minutes != null && (
                      <span className="flex items-center gap-1">
                        <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                        {commuteData.bike_minutes} min bike
                      </span>
                    )}
                    {commuteData.walk_minutes != null && (
                      <span className="flex items-center gap-1">
                        <Footprints className="h-3.5 w-3.5 text-muted-foreground" />
                        {commuteData.walk_minutes} min walk
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Price History */}
              {priceHistory.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Price History
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-1.5 font-medium text-xs text-muted-foreground">
                            Date
                          </th>
                          <th className="text-left px-3 py-1.5 font-medium text-xs text-muted-foreground">
                            Event
                          </th>
                          <th className="text-right px-3 py-1.5 font-medium text-xs text-muted-foreground">
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceHistory.map((entry: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {entry.date
                                ? new Date(
                                    entry.date
                                  ).toLocaleDateString()
                                : "\u2014"}
                            </td>
                            <td className="px-3 py-1.5">
                              {entry.event || entry.type || "\u2014"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium">
                              {entry.price
                                ? `$${Number(entry.price).toLocaleString()}`
                                : "\u2014"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tax info & other details */}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {property.tax_annual != null && (
                  <div>
                    <span className="text-muted-foreground">
                      Annual Tax:{" "}
                    </span>
                    <span className="font-medium">
                      ${property.tax_annual.toLocaleString()}
                    </span>
                  </div>
                )}
                {property.tax_assessed_value != null && (
                  <div>
                    <span className="text-muted-foreground">
                      Assessed Value:{" "}
                    </span>
                    <span className="font-medium">
                      ${property.tax_assessed_value.toLocaleString()}
                    </span>
                  </div>
                )}
                {property.lot_sqft != null && (
                  <div>
                    <span className="text-muted-foreground">Lot: </span>
                    <span className="font-medium">
                      {property.lot_sqft.toLocaleString()} sqft
                    </span>
                  </div>
                )}
                {property.days_on_market != null && (
                  <div>
                    <span className="text-muted-foreground">
                      Days on Market:{" "}
                    </span>
                    <span className="font-medium">
                      {property.days_on_market}
                    </span>
                  </div>
                )}
                {property.mls_number && (
                  <div>
                    <span className="text-muted-foreground">MLS#: </span>
                    <span className="font-medium">{property.mls_number}</span>
                  </div>
                )}
              </div>

              {/* Zillow link */}
              {property.zillow_url && (
                <a
                  href={property.zillow_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on Zillow
                </a>
              )}
            </div>
          )}

          {/* Comments section */}
          {showComments && (
            <div className="space-y-3 pt-3 border-t animate-in fade-in-0 duration-200">
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
              {localComments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No comments yet. Share your thoughts with your agent.
                </p>
              )}
              {localComments.map((comment: any) => {
                const isAgent = !!comment.agent_id;
                return (
                  <div
                    key={comment.id}
                    className={`p-2.5 rounded-lg text-sm ${
                      isAgent
                        ? "bg-primary/5 border border-primary/20"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge
                        variant={isAgent ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {isAgent ? "Your Agent" : "You"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p>{comment.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo gallery dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] sm:max-h-[90vh] w-[calc(100vw-2rem)] sm:w-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="truncate">{property.address}</span>
              {photos.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground shrink-0 ml-2">
                  {galleryIndex + 1} / {photos.length}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {photos.length > 0 && (
            <div
              className="relative touch-pan-y"
              onTouchStart={(e) => {
                const touch = e.touches[0];
                (e.currentTarget as any)._swipeX = touch.clientX;
              }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as any)._swipeX;
                if (startX == null) return;
                const endX = e.changedTouches[0].clientX;
                const diff = startX - endX;
                if (Math.abs(diff) > 50 && photos.length > 1) {
                  if (diff > 0) {
                    setGalleryIndex((i) => (i + 1) % photos.length);
                  } else {
                    setGalleryIndex(
                      (i) => (i - 1 + photos.length) % photos.length
                    );
                  }
                }
              }}
            >
              <img
                src={photos[galleryIndex]}
                alt={`Photo ${galleryIndex + 1}`}
                className="w-full rounded-lg object-contain max-h-[60vh] select-none"
                draggable={false}
              />
              {photos.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hidden sm:flex"
                    onClick={() =>
                      setGalleryIndex(
                        (i) =>
                          (i - 1 + photos.length) % photos.length
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hidden sm:flex"
                    onClick={() =>
                      setGalleryIndex(
                        (i) => (i + 1) % photos.length
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((url: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setGalleryIndex(i)}
                  className={`shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                    i === galleryIndex
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <img
                    src={url}
                    alt=""
                    className="h-14 w-20 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          {/* Gallery footer */}
          {property.zillow_url && (
            <div className="pt-2">
              <a
                href={property.zillow_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on Zillow
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
