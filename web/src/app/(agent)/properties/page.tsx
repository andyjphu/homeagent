import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink } from "lucide-react";
import Link from "next/link";

export default async function PropertiesPage() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  const { data: properties } = await supabase
    .from("properties")
    .select("*, buyer_property_scores(buyer_id, match_score, is_sent_to_buyer, buyers(full_name))")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Properties</h1>
        <p className="text-muted-foreground">
          {properties?.length ?? 0} properties across all buyers
        </p>
      </div>

      {(!properties || properties.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No properties yet. Add properties from a buyer&apos;s page or run research.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y">
          {properties.map((property: any) => {
            const scores = property.buyer_property_scores ?? [];
            const topScore = scores.length > 0
              ? Math.max(...scores.map((s: any) => s.match_score ?? 0))
              : null;
            const buyerNames = scores
              .map((s: any) => s.buyers?.full_name)
              .filter(Boolean);
            const sentCount = scores.filter((s: any) => s.is_sent_to_buyer).length;

            return (
              <div key={property.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                <Link href={`/properties/${property.id}`} className="flex-1 min-w-0 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {property.address}
                    </p>
                    {property.listing_status && property.listing_status !== "active" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {property.listing_status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {property.listing_price && (
                      <span>${property.listing_price.toLocaleString()}</span>
                    )}
                    {property.beds && (
                      <span>{property.beds} bed</span>
                    )}
                    {property.baths && (
                      <span>{property.baths} bath</span>
                    )}
                    {property.sqft && (
                      <span>{property.sqft.toLocaleString()} sqft</span>
                    )}
                    {property.city && (
                      <span>{property.city}{property.state ? `, ${property.state}` : ""}</span>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  {property.zillow_url && (
                    <a
                      href={property.zillow_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Zillow <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {buyerNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end max-w-48">
                      {buyerNames.slice(0, 2).map((name: string) => (
                        <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">
                          {name}
                        </Badge>
                      ))}
                      {buyerNames.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{buyerNames.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                  {sentCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      sent
                    </Badge>
                  )}
                  {topScore !== null && topScore > 0 && (
                    <span className="text-sm font-bold text-primary w-8 text-right">
                      {topScore}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
