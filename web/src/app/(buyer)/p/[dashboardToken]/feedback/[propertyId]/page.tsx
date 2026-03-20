"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const FEEDBACK_TAGS = [
  "Loved the kitchen",
  "Great neighborhood",
  "Perfect layout",
  "Too small",
  "Needs work",
  "Bad location",
  "Loved the yard",
  "Too expensive",
  "Great natural light",
  "Noisy area",
] as const;

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardToken = params.dashboardToken as string;
  const propertyId = params.propertyId as string;

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing feedback
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/dashboard/${dashboardToken}/feedback?propertyId=${propertyId}`
        );
        if (res.ok) {
          const data = await res.json();
          const existing = data.feedback?.[0];
          if (existing) {
            setRating(existing.overall_rating || 0);
            setSelectedTags(existing.tags || []);
            setNotes(existing.notes || "");
          }
        }
      } catch {
        // Ignore — start fresh
      }
      setLoading(false);
    }
    load();
  }, [dashboardToken, propertyId]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/${dashboardToken}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          overallRating: rating,
          tags: selectedTags,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }

      setSubmitted(true);
      toast.success("Feedback submitted! Your agent will see this.");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="py-10 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold">Thank you!</h2>
            <p className="text-sm text-muted-foreground">
              Your feedback has been sent to your agent. It helps them find better
              matches for you.
            </p>
            <Link href={`/p/${dashboardToken}`}>
              <Button variant="outline" className="mt-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/p/${dashboardToken}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-semibold">Post-Showing Feedback</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <>
            {/* Star Rating */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Overall, how did you feel about this property?
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-xs text-muted-foreground">
                  {rating === 1 && "Not for me"}
                  {rating === 2 && "Below expectations"}
                  {rating === 3 && "It was okay"}
                  {rating === 4 && "Really liked it"}
                  {rating === 5 && "Loved it!"}
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Quick impressions (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                      selectedTags.includes(tag)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Additional notes for your agent (optional)
              </label>
              <Textarea
                placeholder="Anything else your agent should know about this property..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={2000}
              />
              {notes.length > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  {notes.length}/2000
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="w-full"
              size="lg"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
