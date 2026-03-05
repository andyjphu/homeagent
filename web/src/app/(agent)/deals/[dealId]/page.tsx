import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DealStageManager } from "@/components/deals/deal-stage-manager";
import { OfferStrategyPanel } from "@/components/deals/offer-strategy-panel";
import { AddOfferForm } from "@/components/deals/add-offer-form";
import { ContractDatesForm } from "@/components/deals/contract-dates-form";
import { ContractTimeline } from "@/components/deals/contract-timeline";

const UNDER_CONTRACT_STAGES = [
  "under_contract",
  "inspection",
  "appraisal",
  "closing",
  "closed",
];

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const supabase = await createClient() as any;

  const { data: deal } = await supabase
    .from("deals")
    .select("*, buyers(*), properties(*)")
    .eq("id", dealId)
    .single();

  if (!deal) notFound();

  const [{ data: offers }, { data: communications }] = await Promise.all([
    supabase
      .from("offers")
      .select("*")
      .eq("deal_id", dealId)
      .order("round_number", { ascending: true }),
    supabase
      .from("communications")
      .select("*")
      .eq("deal_id", dealId)
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);

  const property = deal.properties as any;
  const buyer = deal.buyers as any;
  const isUnderContract = UNDER_CONTRACT_STAGES.includes(deal.stage);
  const contingencies = (deal.contingencies ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/deals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{property?.address}</h1>
          <p className="text-muted-foreground">
            <Link href={`/buyers/${buyer?.id}`} className="hover:underline">
              {buyer?.full_name}
            </Link>
            {" "}&middot; ${property?.listing_price?.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-base py-1 px-3">
            {deal.stage.replace(/_/g, " ")}
          </Badge>
          {deal.deal_probability != null && (
            <div className="text-right">
              <span className="text-2xl font-bold">{deal.deal_probability}%</span>
              <p className="text-xs text-muted-foreground">probability</p>
            </div>
          )}
        </div>
      </div>

      {/* Stage manager */}
      <DealStageManager dealId={deal.id} currentStage={deal.stage} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="offers">Offers ({offers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          {isUnderContract && (
            <TabsTrigger value="contract">Contract</TabsTrigger>
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Property Details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><strong>Address:</strong> {property?.address}</p>
                <p><strong>Price:</strong> ${property?.listing_price?.toLocaleString()}</p>
                <p><strong>Beds/Baths:</strong> {property?.beds}/{property?.baths}</p>
                <p><strong>Sqft:</strong> {property?.sqft?.toLocaleString()}</p>
                <p><strong>Year Built:</strong> {property?.year_built}</p>
                <p><strong>Days on Market:</strong> {property?.days_on_market}</p>
                {property?.seller_motivation_score && (
                  <p><strong>Seller Motivation:</strong> {property.seller_motivation_score}/100</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal Status</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {deal.current_offer_price && (
                  <p><strong>Current Offer:</strong> ${deal.current_offer_price.toLocaleString()}</p>
                )}
                {deal.agreed_price && (
                  <p><strong>Agreed Price:</strong> ${deal.agreed_price.toLocaleString()}</p>
                )}
                {deal.contract_date && (
                  <p><strong>Contract Date:</strong> {new Date(deal.contract_date).toLocaleDateString()}</p>
                )}
                {deal.closing_date && (
                  <p><strong>Closing Date:</strong> {new Date(deal.closing_date).toLocaleDateString()}</p>
                )}
                {deal.earnest_money && (
                  <p><strong>Earnest Money:</strong> ${deal.earnest_money.toLocaleString()}</p>
                )}
                {deal.closed_at && (
                  <p><strong>Closed At:</strong> {new Date(deal.closed_at).toLocaleDateString()}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contract Timeline on Overview when under contract */}
          {isUnderContract && (
            <ContractTimeline
              contractDate={deal.contract_date}
              closingDate={deal.closing_date}
              contingencies={contingencies}
            />
          )}

          {/* Contingency Timeline (legacy display for non-deadline contingencies) */}
          {deal.contingencies && Object.keys(contingencies).length > 0 && !isUnderContract && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contingencies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {Object.entries(contingencies).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b pb-2">
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">
                        {new Date(value).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Offers */}
        <TabsContent value="offers" className="space-y-3 mt-4">
          <AddOfferForm dealId={deal.id} />

          {(!offers || offers.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No offers recorded yet. Add one above.</p>
              </CardContent>
            </Card>
          ) : (
            offers.map((offer: any) => {
              const analysis = (offer.ai_analysis || {}) as Record<string, unknown>;
              return (
                <Card key={offer.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Round {offer.round_number}</Badge>
                          <Badge>{offer.offer_type.replace(/_/g, " ")}</Badge>
                        </div>
                        <p className="text-lg font-bold">
                          ${offer.price.toLocaleString()}
                        </p>
                        {offer.closing_days && (
                          <p className="text-sm text-muted-foreground">
                            {offer.closing_days}-day close
                          </p>
                        )}
                        {offer.other_terms && (
                          <p className="text-sm text-muted-foreground">
                            {offer.other_terms}
                          </p>
                        )}
                        {offer.response_deadline && (
                          <p className="text-xs text-muted-foreground">
                            Response by: {new Date(offer.response_deadline).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(offer.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    {analysis.strategy_recommendation ? (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-xs font-medium mb-1">AI Analysis</p>
                        <p className="text-sm">{String(analysis.strategy_recommendation)}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Strategy */}
        <TabsContent value="strategy" className="mt-4">
          <OfferStrategyPanel
            dealId={deal.id}
            agentId={deal.agent_id}
            strategy={deal.offer_strategy_brief as any}
          />
        </TabsContent>

        {/* Communications */}
        <TabsContent value="communications" className="space-y-3 mt-4">
          {(!communications || communications.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No communications for this deal.</p>
              </CardContent>
            </Card>
          ) : (
            communications.map((comm: any) => (
              <Card key={comm.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{comm.type}</Badge>
                        <Badge variant="secondary">{comm.direction}</Badge>
                      </div>
                      {comm.subject && (
                        <p className="font-medium mt-1">{comm.subject}</p>
                      )}
                      {comm.raw_content && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                          {comm.raw_content}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(comm.occurred_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Contract Tab - Under Contract details */}
        {isUnderContract && (
          <TabsContent value="contract" className="space-y-4 mt-4">
            <ContractDatesForm
              dealId={deal.id}
              contractDate={deal.contract_date}
              closingDate={deal.closing_date}
              earnestMoney={deal.earnest_money}
              agreedPrice={deal.agreed_price}
              contingencies={contingencies}
            />

            <ContractTimeline
              contractDate={deal.contract_date}
              closingDate={deal.closing_date}
              contingencies={contingencies}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
