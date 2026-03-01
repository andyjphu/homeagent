import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const supabase = await createClient() as any;

  const { data: property } = await supabase
    .from("properties")
    .select("*, listing_agents(*)")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  const listingAgent = (property as any).listing_agents;
  const priceHistory = (property.price_history as any[]) || [];
  const schoolRatings = (property.school_ratings as any) || {};

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/deals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

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
              View on Zillow <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

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
                <p className="font-medium">{property.sqft?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lot Sqft</p>
                <p className="font-medium">{property.lot_sqft?.toLocaleString() || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Year Built</p>
                <p className="font-medium">{property.year_built || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{property.property_type || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">HOA</p>
                <p className="font-medium">
                  {property.hoa_monthly ? `$${property.hoa_monthly}/mo` : "None"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax (Annual)</p>
                <p className="font-medium">
                  {property.tax_annual ? `$${property.tax_annual.toLocaleString()}` : "N/A"}
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
              <p className="font-medium">{property.days_on_market ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline" className="capitalize">
                {property.listing_status}
              </Badge>
            </div>
            {property.tax_assessed_value && (
              <div>
                <p className="text-xs text-muted-foreground">Tax Assessed Value</p>
                <p className="font-medium">
                  ${property.tax_assessed_value.toLocaleString()}
                  {property.listing_price && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({(
                        ((property.listing_price - property.tax_assessed_value) /
                          property.tax_assessed_value) *
                        100
                      ).toFixed(1)}
                      % {property.listing_price > property.tax_assessed_value ? "above" : "below"})
                    </span>
                  )}
                </p>
              </div>
            )}
            {property.seller_motivation_score != null && (
              <div>
                <p className="text-xs text-muted-foreground">Seller Motivation</p>
                <p className="font-medium">{property.seller_motivation_score}/100</p>
                {property.seller_motivation_reasoning && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {property.seller_motivation_reasoning}
                  </p>
                )}
              </div>
            )}
            {property.walk_score && (
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Walk Score</p>
                  <p className="font-medium">{property.walk_score}</p>
                </div>
                {property.transit_score && (
                  <div>
                    <p className="text-xs text-muted-foreground">Transit Score</p>
                    <p className="font-medium">{property.transit_score}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Schools */}
      {Object.keys(schoolRatings).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">School Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3">
              {Object.entries(schoolRatings).map(([type, data]: [string, any]) => (
                <div key={type} className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground capitalize">{type}</p>
                  <p className="font-medium">{data.name}</p>
                  {data.rating && (
                    <Badge variant="secondary">{data.rating}/10</Badge>
                  )}
                </div>
              ))}
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
                <div key={i} className="flex justify-between text-sm border-b pb-2">
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
            <p><strong>Name:</strong> {listingAgent.name}</p>
            {listingAgent.brokerage && <p><strong>Brokerage:</strong> {listingAgent.brokerage}</p>}
            {listingAgent.active_listing_count && (
              <p><strong>Active Listings:</strong> {listingAgent.active_listing_count}</p>
            )}
            {listingAgent.avg_list_to_sale_ratio && (
              <p><strong>Avg List-to-Sale Ratio:</strong> {(listingAgent.avg_list_to_sale_ratio * 100).toFixed(1)}%</p>
            )}
            {listingAgent.avg_counter_rounds && (
              <p><strong>Avg Counter Rounds:</strong> {listingAgent.avg_counter_rounds}</p>
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
            <p className="text-sm whitespace-pre-wrap">{property.listing_description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
