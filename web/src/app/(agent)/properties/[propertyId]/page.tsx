import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  Droplets,
  GraduationCap,
  Wind,
  ShoppingCart,
  TreePine,
  Hospital,
  Users,
  Home,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrichButton } from "@/components/properties/enrich-button";
import type { PropertyEnrichment } from "@/lib/enrichment/types";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const supabase = (await createClient()) as any;

  const { data: property } = await supabase
    .from("properties")
    .select("*, listing_agents(*)")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  const listingAgent = (property as any).listing_agents;
  const priceHistory = (property.price_history as any[]) || [];
  const schoolRatings = (property.school_ratings as any) || {};
  const photos = (property.photos as string[]) || [];
  const enrichment = property.enrichment_data as PropertyEnrichment | null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/properties">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{property.address}</h1>
          <p className="text-muted-foreground">
            {property.city}, {property.state} {property.zip}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            ${property.listing_price?.toLocaleString()}
          </p>
          {property.zillow_url && (
            <a
              href={property.zillow_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              View Listing <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-lg overflow-hidden">
          {photos.slice(0, 6).map((url, i) => (
            <div
              key={i}
              className={`relative ${i === 0 ? "col-span-2 row-span-2" : ""}`}
            >
              <img
                src={url}
                alt={`Property photo ${i + 1}`}
                className="w-full h-full object-cover rounded-lg"
                style={{ minHeight: i === 0 ? 280 : 140 }}
              />
            </div>
          ))}
          {photos.length > 6 && (
            <div className="flex items-center justify-center bg-muted rounded-lg text-sm text-muted-foreground">
              +{photos.length - 6} more
            </div>
          )}
        </div>
      )}

      {/* Enrich Button + freshness */}
      <div className="flex items-center justify-between">
        <EnrichButton propertyId={propertyId} />
        {enrichment?.enriched_at && (
          <span className="text-xs text-muted-foreground">
            Enriched{" "}
            {new Date(enrichment.enriched_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Property Details + Market Intelligence */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Property Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Beds</p>
                <p className="font-medium">{property.beds}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Baths</p>
                <p className="font-medium">{property.baths}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sqft</p>
                <p className="font-medium">
                  {property.sqft?.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lot Sqft</p>
                <p className="font-medium">
                  {property.lot_sqft?.toLocaleString() || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Year Built</p>
                <p className="font-medium">{property.year_built || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium capitalize">
                  {property.property_type || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">HOA</p>
                <p className="font-medium">
                  {property.hoa_monthly
                    ? `$${property.hoa_monthly}/mo`
                    : "None"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax (Annual)</p>
                <p className="font-medium">
                  {property.tax_annual
                    ? `$${property.tax_annual.toLocaleString()}`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market Intelligence</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Days on Market</p>
              <p className="font-medium">
                {property.days_on_market ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline" className="capitalize">
                {property.listing_status}
              </Badge>
            </div>
            {property.tax_assessed_value && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Tax Assessed Value
                </p>
                <p className="font-medium">
                  ${property.tax_assessed_value.toLocaleString()}
                  {property.listing_price && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (
                      {(
                        ((property.listing_price -
                          property.tax_assessed_value) /
                          property.tax_assessed_value) *
                        100
                      ).toFixed(1)}
                      %{" "}
                      {property.listing_price > property.tax_assessed_value
                        ? "above"
                        : "below"}
                      )
                    </span>
                  )}
                </p>
              </div>
            )}
            {property.seller_motivation_score != null && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Seller Motivation
                </p>
                <p className="font-medium">
                  {property.seller_motivation_score}/100
                </p>
                {property.seller_motivation_reasoning && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {property.seller_motivation_reasoning}
                  </p>
                )}
              </div>
            )}
            {/* Walk score from enrichment or legacy field */}
            {(enrichment?.walkability || property.walk_score) && (
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Walk Score</p>
                  <p className="font-medium">
                    {enrichment?.walkability?.walk_score ?? property.walk_score}
                  </p>
                </div>
                {(enrichment?.walkability?.transit_score ??
                  property.transit_score) && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Transit Score
                    </p>
                    <p className="font-medium">
                      {enrichment?.walkability?.transit_score ??
                        property.transit_score}
                    </p>
                  </div>
                )}
                {enrichment?.walkability?.bike_score && (
                  <div>
                    <p className="text-xs text-muted-foreground">Bike Score</p>
                    <p className="font-medium">
                      {enrichment.walkability.bike_score}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Data Sections */}
      {enrichment && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Flood Risk */}
          {enrichment.flood && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Droplets className="h-4 w-4" />
                  Flood Risk
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Zone:</span>
                  <Badge
                    variant={
                      enrichment.flood.risk_level === "high" ||
                      enrichment.flood.risk_level === "very_high"
                        ? "destructive"
                        : enrichment.flood.risk_level === "moderate"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {enrichment.flood.zone}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Risk Level:</span>{" "}
                  <span className="capitalize font-medium">
                    {enrichment.flood.risk_level}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Insurance Required:
                  </span>{" "}
                  <span className="font-medium">
                    {enrichment.flood.insurance_required ? "Yes" : "No"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schools */}
          {enrichment.schools && enrichment.schools.nearby?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Nearby Schools
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {enrichment.schools.nearby.slice(0, 5).map((school, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-xs">{school.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {school.type} &middot; {school.grades}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {school.distance_miles} mi
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Air Quality */}
          {enrichment.air_quality && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wind className="h-4 w-4" />
                  Air Quality
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">
                    {enrichment.air_quality.aqi}
                  </span>
                  <div>
                    <p className="font-medium">{enrichment.air_quality.category}</p>
                    <p className="text-xs text-muted-foreground">AQI Index</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Demographics */}
          {enrichment.demographics && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Demographics
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Median Income
                    </p>
                    <p className="font-medium">
                      ${enrichment.demographics.median_income?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Median Home Value
                    </p>
                    <p className="font-medium">
                      $
                      {enrichment.demographics.median_home_value?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Population</p>
                    <p className="font-medium">
                      {enrichment.demographics.population?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Owner-Occupied
                    </p>
                    <p className="font-medium">
                      {enrichment.demographics.owner_occupied_pct}%
                    </p>
                  </div>
                  {enrichment.demographics.median_age && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Median Age
                      </p>
                      <p className="font-medium">
                        {enrichment.demographics.median_age}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nearby Amenities */}
          {enrichment.amenities && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Nearby Amenities
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {enrichment.amenities.grocery_count} groceries
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TreePine className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{enrichment.amenities.park_count} parks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Hospital className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {enrichment.amenities.hospital_count} hospitals
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Home className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {enrichment.amenities.restaurant_count} restaurants
                    </span>
                  </div>
                </div>
                {enrichment.amenities.nearest_grocery_miles > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Nearest grocery: {enrichment.amenities.nearest_grocery_miles}{" "}
                    mi
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Crime Data */}
          {enrichment.crime && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Crime Data
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {enrichment.crime.safety_score != null && (
                  <div>
                    <span className="text-muted-foreground">
                      Safety Score:
                    </span>{" "}
                    <span className="font-medium">
                      {enrichment.crime.safety_score}/100
                    </span>
                  </div>
                )}
                {enrichment.crime.violent_crime_rate != null && (
                  <div>
                    <span className="text-muted-foreground">
                      Violent Crime Rate:
                    </span>{" "}
                    <span className="font-medium">
                      {enrichment.crime.violent_crime_rate}
                    </span>
                  </div>
                )}
                {enrichment.crime.property_crime_rate != null && (
                  <div>
                    <span className="text-muted-foreground">
                      Property Crime Rate:
                    </span>{" "}
                    <span className="font-medium">
                      {enrichment.crime.property_crime_rate}
                    </span>
                  </div>
                )}
                {enrichment.crime.data_year && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Data from {enrichment.crime.data_year} ({enrichment.crime.source})
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Legacy Schools (from old school_ratings column) */}
      {!enrichment?.schools &&
        Object.keys(schoolRatings).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Ratings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(schoolRatings).map(
                  ([type, data]: [string, any]) => (
                    <div key={type} className="p-3 border rounded-lg">
                      <p className="text-xs text-muted-foreground capitalize">
                        {type}
                      </p>
                      <p className="font-medium">{data.name}</p>
                      {data.rating && (
                        <Badge variant="secondary">{data.rating}/10</Badge>
                      )}
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Price History */}
      {priceHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {priceHistory.map((entry, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm border-b pb-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {entry.event}
                    </Badge>
                    <span>${entry.price?.toLocaleString()}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listing Agent */}
      {listingAgent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing Agent Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <strong>Name:</strong> {listingAgent.name}
            </p>
            {listingAgent.brokerage && (
              <p>
                <strong>Brokerage:</strong> {listingAgent.brokerage}
              </p>
            )}
            {listingAgent.active_listing_count && (
              <p>
                <strong>Active Listings:</strong>{" "}
                {listingAgent.active_listing_count}
              </p>
            )}
            {listingAgent.avg_list_to_sale_ratio && (
              <p>
                <strong>Avg List-to-Sale Ratio:</strong>{" "}
                {(listingAgent.avg_list_to_sale_ratio * 100).toFixed(1)}%
              </p>
            )}
            {listingAgent.avg_counter_rounds && (
              <p>
                <strong>Avg Counter Rounds:</strong>{" "}
                {listingAgent.avg_counter_rounds}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {property.listing_description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {property.listing_description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
