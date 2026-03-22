"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

export default function CloseFeedbackPage() {
  const params = useParams();
  const portalToken = params.portalToken as string;
  const dealId = params.dealId as string;

  const [score, setScore] = useState<number>(8);
  const [wouldRefer, setWouldRefer] = useState<boolean | null>(null);
  const [testimonial, setTestimonial] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/buyer-portal/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portalToken,
            dealId,
            satisfactionScore: score,
            wouldRefer,
            testimonial: testimonial.trim() || null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit feedback");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
            <h2 className="text-lg font-semibold">Thank you!</h2>
            <p className="text-sm text-muted-foreground">
              Your feedback means a lot. Congratulations on your new home!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>How was your experience?</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your honest feedback helps your agent serve future clients better.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Satisfaction Score */}
              <div className="space-y-3">
                <Label>Overall satisfaction</Label>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(n)}
                      className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                        n <= score
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Not satisfied</span>
                  <span>Very satisfied</span>
                </div>
              </div>

              {/* Would Refer */}
              <div className="space-y-3">
                <Label>Would you refer your agent to a friend?</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={wouldRefer === true ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWouldRefer(true)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={wouldRefer === false ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWouldRefer(false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              {/* Testimonial */}
              <div className="space-y-2">
                <Label htmlFor="testimonial">
                  Share a testimonial (optional)
                </Label>
                <Textarea
                  id="testimonial"
                  placeholder="What stood out about working with your agent?"
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  rows={4}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || wouldRefer === null}
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Powered by FoyerFind
        </p>
      </div>
    </div>
  );
}
