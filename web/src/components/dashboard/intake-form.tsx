"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Send,
  CheckCircle2,
  Users,
  DollarSign,
  Home,
  MapPin,
  Star,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

function splitCommas(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumberOrUndefined(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

export function IntakeForm({
  buyerName,
  agentName,
  dashboardToken,
  existingProfile,
}: {
  buyerName: string;
  agentName: string | null;
  dashboardToken: string;
  existingProfile: any;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    household_size: existingProfile.household_size?.toString() ?? "",
    timeline: existingProfile.timeline ?? "",
    budget_min: existingProfile.budget_min?.toString() ?? "",
    budget_max: existingProfile.budget_max?.toString() ?? "",
    hoa_tolerance: existingProfile.hoa_tolerance?.toString() ?? "",
    beds_min: existingProfile.beds_min?.toString() ?? "",
    baths_min: existingProfile.baths_min?.toString() ?? "",
    sqft_min: existingProfile.sqft_min?.toString() ?? "",
    preferred_areas: existingProfile.preferred_areas?.join(", ") ?? "",
    max_commute_minutes: existingProfile.max_commute_minutes?.toString() ?? "",
    school_rating_min: existingProfile.school_rating_min?.toString() ?? "",
    must_have_amenities: existingProfile.must_have_amenities?.join(", ") ?? "",
    priorities_ranked: existingProfile.priorities_ranked?.join(", ") ?? "",
    concerns: existingProfile.concerns?.join(", ") ?? "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const intentProfile = {
      household_size: toNumberOrUndefined(form.household_size),
      timeline: form.timeline || undefined,
      budget_min: toNumberOrUndefined(form.budget_min),
      budget_max: toNumberOrUndefined(form.budget_max),
      hoa_tolerance: toNumberOrUndefined(form.hoa_tolerance),
      beds_min: toNumberOrUndefined(form.beds_min),
      baths_min: toNumberOrUndefined(form.baths_min),
      sqft_min: toNumberOrUndefined(form.sqft_min),
      preferred_areas: splitCommas(form.preferred_areas),
      max_commute_minutes: toNumberOrUndefined(form.max_commute_minutes),
      school_rating_min: toNumberOrUndefined(form.school_rating_min),
      must_have_amenities: splitCommas(form.must_have_amenities),
      priorities_ranked: splitCommas(form.priorities_ranked),
      concerns: splitCommas(form.concerns),
    };

    const res = await fetch(`/api/dashboard/${dashboardToken}/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentProfile }),
    });

    setSaving(false);
    if (res.ok) {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">
            Thank you, {buyerName}!
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Your preferences have been saved.
            {agentName
              ? ` ${agentName} will use this to curate properties just for you.`
              : " Your agent will use this to curate properties just for you."}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href={`/d/${dashboardToken}`}>
              <Button>View Your Dashboard</Button>
            </Link>
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              Edit Your Answers
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Intro */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold mb-2">
          Tell us about your dream home
        </h1>
        <p className="text-muted-foreground">
          Fill out what you can &mdash; you can always update these later.
          {agentName && (
            <>
              {" "}
              This helps {agentName} find the best properties for you.
            </>
          )}
        </p>
      </div>

      {/* Section 1: About You */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            About You
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="household_size">
              How many people will live in the home?
            </Label>
            <Input
              id="household_size"
              type="number"
              min={1}
              value={form.household_size}
              onChange={(e) => updateField("household_size", e.target.value)}
              placeholder="e.g., 4"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timeline">When are you hoping to move?</Label>
            <Select
              value={form.timeline}
              onValueChange={(v) => updateField("timeline", v)}
            >
              <SelectTrigger id="timeline">
                <SelectValue placeholder="Select timeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Immediately (0-1 months)">
                  Immediately (0-1 months)
                </SelectItem>
                <SelectItem value="Soon (1-3 months)">
                  Soon (1-3 months)
                </SelectItem>
                <SelectItem value="A few months (3-6 months)">
                  A few months (3-6 months)
                </SelectItem>
                <SelectItem value="Within a year">Within a year</SelectItem>
                <SelectItem value="Just exploring">Just exploring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Budget */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Budget
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget_min">Minimum budget ($)</Label>
            <Input
              id="budget_min"
              type="number"
              value={form.budget_min}
              onChange={(e) => updateField("budget_min", e.target.value)}
              placeholder="300,000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget_max">Maximum budget ($)</Label>
            <Input
              id="budget_max"
              type="number"
              value={form.budget_max}
              onChange={(e) => updateField("budget_max", e.target.value)}
              placeholder="600,000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hoa_tolerance">Max monthly HOA ($)</Label>
            <Input
              id="hoa_tolerance"
              type="number"
              value={form.hoa_tolerance}
              onChange={(e) => updateField("hoa_tolerance", e.target.value)}
              placeholder="300"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Home Basics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4" />
            Home Basics
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="beds_min">Minimum bedrooms</Label>
            <Select
              value={form.beds_min}
              onValueChange={(v) => updateField("beds_min", v)}
            >
              <SelectTrigger id="beds_min">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}+
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="baths_min">Minimum bathrooms</Label>
            <Select
              value={form.baths_min}
              onValueChange={(v) => updateField("baths_min", v)}
            >
              <SelectTrigger id="baths_min">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}+
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sqft_min">Minimum square footage</Label>
            <Input
              id="sqft_min"
              type="number"
              value={form.sqft_min}
              onChange={(e) => updateField("sqft_min", e.target.value)}
              placeholder="1,500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Location */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="preferred_areas">
              What areas, neighborhoods, or zip codes interest you?
            </Label>
            <Textarea
              id="preferred_areas"
              value={form.preferred_areas}
              onChange={(e) => updateField("preferred_areas", e.target.value)}
              placeholder="e.g., Downtown Austin, Cedar Park, Round Rock"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple areas with commas
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="max_commute_minutes">
                Maximum commute time (minutes)
              </Label>
              <Input
                id="max_commute_minutes"
                type="number"
                value={form.max_commute_minutes}
                onChange={(e) =>
                  updateField("max_commute_minutes", e.target.value)
                }
                placeholder="30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school_rating_min">
                Minimum school rating (1-10)
              </Label>
              <Select
                value={form.school_rating_min}
                onValueChange={(v) => updateField("school_rating_min", v)}
              >
                <SelectTrigger id="school_rating_min">
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  {[5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}+
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Must-Haves & Priorities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Must-Haves & Priorities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="must_have_amenities">
              What features are must-haves for you?
            </Label>
            <Textarea
              id="must_have_amenities"
              value={form.must_have_amenities}
              onChange={(e) =>
                updateField("must_have_amenities", e.target.value)
              }
              placeholder="e.g., garage, pool, home office, fenced yard, updated kitchen"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Separate with commas
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priorities_ranked">
              Rank your top priorities (most important first)
            </Label>
            <Textarea
              id="priorities_ranked"
              value={form.priorities_ranked}
              onChange={(e) => updateField("priorities_ranked", e.target.value)}
              placeholder="e.g., Location, Price, School district, Size, Condition"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              List in order of importance, separated by commas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Anything Else */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Anything Else
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="concerns">
              Any concerns or deal-breakers we should know about?
            </Label>
            <Textarea
              id="concerns"
              value={form.concerns}
              onChange={(e) => updateField("concerns", e.target.value)}
              placeholder="e.g., flood zones, noisy streets, old plumbing, foundation issues"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Separate with commas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        {saving ? "Saving..." : "Save My Preferences"}
      </Button>
    </form>
  );
}
