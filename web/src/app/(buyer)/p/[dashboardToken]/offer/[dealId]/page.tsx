import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock } from "lucide-react";
import { DealTimeline } from "@/components/dashboard/deal-timeline";

export default async function OfferStatusPage({
  params,
}: {
  params: Promise<{ dashboardToken: string; dealId: string }>;
}) {
  const { dashboardToken, dealId } = await params;
  const supabase = createAdminClient() as any;

  // Validate token → buyer
  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, agent_id, full_name")
    .eq("dashboard_token", dashboardToken)
    .single();

  if (!buyer) notFound();

  // Fetch deal — must belong to this buyer
  const { data: deal } = await supabase
    .from("deals")
    .select("*, properties(*)")
    .eq("id", dealId)
    .eq("buyer_id", buyer.id)
    .single();

  if (!deal) notFound();

  // Fetch offers for this deal
  const { data: offers } = await supabase
    .from("offers")
    .select("*")
    .eq("deal_id", dealId)
    .order("round_number", { ascending: true });

  const property = deal.properties;
  const contingencies = Array.isArray(deal.contingencies)
    ? deal.contingencies
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/p/${dashboardToken}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">Deal Progress</h1>
            {property && (
              <p className="text-sm text-muted-foreground">{property.address}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Deal Timeline */}
        <DealTimeline deal={deal} />

        {/* Key deal info */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">Deal Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {deal.current_offer_price != null && (
                <div>
                  <p className="text-muted-foreground">Current Offer</p>
                  <p className="font-semibold text-lg">
                    ${deal.current_offer_price.toLocaleString()}
                  </p>
                </div>
              )}
              {deal.agreed_price != null && (
                <div>
                  <p className="text-muted-foreground">Agreed Price</p>
                  <p className="font-semibold text-lg">
                    ${deal.agreed_price.toLocaleString()}
                  </p>
                </div>
              )}
              {property?.listing_price != null && (
                <div>
                  <p className="text-muted-foreground">Listing Price</p>
                  <p className="font-medium">
                    ${property.listing_price.toLocaleString()}
                  </p>
                </div>
              )}
              {deal.earnest_money != null && (
                <div>
                  <p className="text-muted-foreground">Earnest Money</p>
                  <p className="font-medium">
                    ${deal.earnest_money.toLocaleString()}
                  </p>
                </div>
              )}
              {deal.contract_date && (
                <div>
                  <p className="text-muted-foreground">Contract Date</p>
                  <p className="font-medium">
                    {new Date(deal.contract_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {deal.closing_date && (
                <div>
                  <p className="text-muted-foreground">Target Close</p>
                  <p className="font-medium">
                    {new Date(deal.closing_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contingencies / Deadlines */}
        {contingencies.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold">Upcoming Deadlines</h3>
              {contingencies.map((c: any, i: number) => {
                const deadline = c.deadline
                  ? new Date(c.deadline)
                  : null;
                const isPast = deadline && deadline < new Date();
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{c.name || c.type}</span>
                    </div>
                    {deadline && (
                      <Badge
                        variant={isPast ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {deadline.toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Offer History */}
        {offers && offers.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold">Offer History</h3>
              <div className="space-y-2">
                {offers.map((offer: any) => (
                  <div
                    key={offer.id}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <div>
                      <span className="font-medium capitalize">
                        {offer.offer_type?.replace(/_/g, " ") || `Round ${offer.round_number}`}
                      </span>
                      {offer.closing_days && (
                        <span className="text-muted-foreground ml-2">
                          ({offer.closing_days} day close)
                        </span>
                      )}
                    </div>
                    <span className="font-semibold">
                      ${offer.price?.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
