"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SlidersHorizontal, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FilterPanel({
  dashboardToken,
  intentProfile,
}: {
  dashboardToken: string;
  intentProfile: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    budget_min: intentProfile.budget_min ?? "",
    budget_max: intentProfile.budget_max ?? "",
    beds_min: intentProfile.beds_min ?? "",
    baths_min: intentProfile.baths_min ?? "",
    sqft_min: intentProfile.sqft_min ?? "",
    max_commute_minutes: intentProfile.max_commute_minutes ?? "",
    school_rating_min: intentProfile.school_rating_min ?? "",
    hoa_tolerance: intentProfile.hoa_tolerance ?? "",
    preferred_areas: Array.isArray(intentProfile.preferred_areas)
      ? intentProfile.preferred_areas.join(", ")
      : "",
  });
  const router = useRouter();

  async function handleSave() {
    setSaving(true);

    const numericFields = Object.fromEntries(
      Object.entries(filters)
        .filter(([k]) => k !== "preferred_areas")
        .map(([k, v]) => [k, v === "" ? undefined : Number(v)])
    );
    const areas = filters.preferred_areas
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const updatedProfile = {
      ...intentProfile,
      ...numericFields,
      preferred_areas: areas.length > 0 ? areas : undefined,
    };

    const res = await fetch(`/api/dashboard/${dashboardToken}/criteria`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intentProfile: updatedProfile,
      }),
    });

    setSaving(false);

    if (res.ok) {
      toast.success("Search criteria saved. Your agent has been notified.");
      setExpanded(false);
    } else {
      toast.error("Failed to save criteria. Please try again.");
    }

    router.refresh();
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        onClick={() => setExpanded(true)}
        className="w-full"
      >
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        Adjust Search Criteria
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Search Criteria
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Preferred Areas / Neighborhoods</Label>
          <Textarea
            value={filters.preferred_areas}
            onChange={(e) =>
              setFilters({ ...filters, preferred_areas: e.target.value })
            }
            placeholder="e.g., Downtown Austin, Cedar Park, 78704"
            rows={2}
          />
          <p className="text-[11px] text-muted-foreground">
            Separate multiple areas with commas
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Min Budget</Label>
            <Input
              type="number"
              value={filters.budget_min}
              onChange={(e) =>
                setFilters({ ...filters, budget_min: e.target.value })
              }
              placeholder="400000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Budget</Label>
            <Input
              type="number"
              value={filters.budget_max}
              onChange={(e) =>
                setFilters({ ...filters, budget_max: e.target.value })
              }
              placeholder="750000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min Beds</Label>
            <Input
              type="number"
              value={filters.beds_min}
              onChange={(e) =>
                setFilters({ ...filters, beds_min: e.target.value })
              }
              placeholder="3"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min Baths</Label>
            <Input
              type="number"
              value={filters.baths_min}
              onChange={(e) =>
                setFilters({ ...filters, baths_min: e.target.value })
              }
              placeholder="2"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min Sqft</Label>
            <Input
              type="number"
              value={filters.sqft_min}
              onChange={(e) =>
                setFilters({ ...filters, sqft_min: e.target.value })
              }
              placeholder="2000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Commute (min)</Label>
            <Input
              type="number"
              value={filters.max_commute_minutes}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  max_commute_minutes: e.target.value,
                })
              }
              placeholder="30"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min School Rating</Label>
            <Input
              type="number"
              value={filters.school_rating_min}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  school_rating_min: e.target.value,
                })
              }
              placeholder="7"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max HOA ($/mo)</Label>
            <Input
              type="number"
              value={filters.hoa_tolerance}
              onChange={(e) =>
                setFilters({ ...filters, hoa_tolerance: e.target.value })
              }
              placeholder="300"
            />
          </div>
        </div>
        <Button onClick={handleSave} className="w-full mt-4" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
