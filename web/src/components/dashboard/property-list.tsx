"use client";

import { useState } from "react";
import { BuyerPropertyCard } from "./buyer-property-card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, X, ImageIcon } from "lucide-react";

function ComparisonRow({
  label,
  values,
  mode = "highest",
}: {
  label: string;
  values: (string | number | null | undefined)[];
  mode?: "highest" | "lowest" | "none";
}) {
  let winnerIdx = -1;
  if (mode !== "none") {
    const nums = values.map((v) =>
      typeof v === "number" ? v : null
    );
    const validNums = nums.filter((n): n is number => n !== null);
    if (validNums.length >= 2) {
      const target =
        mode === "highest"
          ? Math.max(...validNums)
          : Math.min(...validNums);
      winnerIdx = nums.indexOf(target);
    }
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-sm font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-3 py-2 text-sm text-center ${
            i === winnerIdx
              ? "bg-green-50 dark:bg-green-950/30 font-semibold"
              : ""
          }`}
        >
          {v != null
            ? typeof v === "number"
              ? v.toLocaleString()
              : v
            : "\u2014"}
        </td>
      ))}
    </tr>
  );
}

export function PropertyList({
  scores,
  commentsByProperty,
  buyerId,
  dashboardToken,
}: {
  scores: any[];
  commentsByProperty: Record<string, any[]>;
  buyerId: string;
  dashboardToken: string;
}) {
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  function toggleCompare(propertyId: string) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else if (next.size < 3) {
        next.add(propertyId);
      }
      return next;
    });
  }

  const compareItems = scores.filter((s) =>
    compareIds.has(s.property_id)
  );

  return (
    <>
      <div className="space-y-4">
        {scores.map((score: any, index: number) => (
          <BuyerPropertyCard
            key={score.id}
            score={score}
            property={score.properties}
            rank={index + 1}
            comments={commentsByProperty[score.property_id] || []}
            buyerId={buyerId}
            dashboardToken={dashboardToken}
            isCompareSelected={compareIds.has(score.property_id)}
            onCompareToggle={() => toggleCompare(score.property_id)}
          />
        ))}
      </div>

      {/* Floating compare bar */}
      {compareIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <Button
            onClick={() => setCompareOpen(true)}
            size="lg"
            className="shadow-xl rounded-full px-8"
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Compare {compareIds.size} Properties
          </Button>
        </div>
      )}

      {/* Comparison sheet */}
      <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] sm:h-[80vh]"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>Property Comparison</SheetTitle>
            <SheetDescription>
              Comparing {compareItems.length} properties side by side
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[120px]" />
                    {compareItems.map((s) => {
                      const p = s.properties;
                      const photos: string[] = Array.isArray(
                        p?.photos
                      )
                        ? p.photos
                        : [];
                      return (
                        <th
                          key={s.id}
                          className="px-3 py-2 text-center min-w-[180px]"
                        >
                          <div className="space-y-1.5">
                            {photos.length > 0 ? (
                              <img
                                src={photos[0]}
                                alt=""
                                className="h-24 w-full object-cover rounded-md"
                              />
                            ) : (
                              <div className="h-24 w-full bg-muted rounded-md flex items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                              </div>
                            )}
                            <p className="text-sm font-semibold truncate">
                              {p?.address}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                toggleCompare(s.property_id);
                                if (compareIds.size <= 2)
                                  setCompareOpen(false);
                              }}
                            >
                              <X className="h-3 w-3 mr-1" />{" "}
                              Remove
                            </Button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    label="Price"
                    values={compareItems.map((s) =>
                      s.properties?.listing_price != null
                        ? `$${s.properties.listing_price.toLocaleString()}`
                        : null
                    )}
                    mode="none"
                  />
                  <ComparisonRow
                    label="Match Score"
                    values={compareItems.map(
                      (s) => s.match_score
                    )}
                  />
                  <ComparisonRow
                    label="Beds"
                    values={compareItems.map(
                      (s) => s.properties?.beds
                    )}
                  />
                  <ComparisonRow
                    label="Baths"
                    values={compareItems.map(
                      (s) => s.properties?.baths
                    )}
                  />
                  <ComparisonRow
                    label="Sqft"
                    values={compareItems.map(
                      (s) => s.properties?.sqft
                    )}
                  />
                  <ComparisonRow
                    label="Year Built"
                    values={compareItems.map(
                      (s) => s.properties?.year_built
                    )}
                  />
                  <ComparisonRow
                    label="Walk Score"
                    values={compareItems.map(
                      (s) => s.properties?.walk_score
                    )}
                  />
                  <ComparisonRow
                    label="Transit Score"
                    values={compareItems.map(
                      (s) => s.properties?.transit_score
                    )}
                  />
                  <ComparisonRow
                    label="HOA/mo"
                    values={compareItems.map((s) =>
                      s.properties?.hoa_monthly != null
                        ? `$${s.properties.hoa_monthly}`
                        : null
                    )}
                    mode="none"
                  />
                  <ComparisonRow
                    label="Tax/yr"
                    values={compareItems.map((s) =>
                      s.properties?.tax_annual != null
                        ? `$${s.properties.tax_annual.toLocaleString()}`
                        : null
                    )}
                    mode="none"
                  />
                  <ComparisonRow
                    label="Days on Market"
                    values={compareItems.map(
                      (s) => s.properties?.days_on_market
                    )}
                    mode="lowest"
                  />
                  <ComparisonRow
                    label="School Rating"
                    values={compareItems.map((s) => {
                      const ratings = s.properties?.school_ratings;
                      if (
                        !ratings ||
                        typeof ratings !== "object" ||
                        Array.isArray(ratings)
                      )
                        return null;
                      const entries = Object.values(
                        ratings
                      ) as any[];
                      const best = entries.reduce(
                        (max: any, r: any) =>
                          r?.rating > (max?.rating ?? 0)
                            ? r
                            : max,
                        null
                      );
                      return best?.rating
                        ? `${best.rating}/10`
                        : null;
                    })}
                    mode="none"
                  />
                  <ComparisonRow
                    label="Commute (drive)"
                    values={compareItems.map((s) => {
                      const c = s.properties?.commute_data;
                      if (!c || typeof c !== "object") return null;
                      return c.drive_minutes != null
                        ? `${c.drive_minutes} min`
                        : null;
                    })}
                    mode="none"
                  />
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
