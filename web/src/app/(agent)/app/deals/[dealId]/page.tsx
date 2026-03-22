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
import { DealRiskSignals } from "@/components/deals/deal-risk-signals";

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
  const supabase = (await createClient()) as any;

  const { data: deal } = await supabase
    .from("deals")
    .select("*, buyers(*), properties(*), listing_agents:properties(listing_agent_id)")
    .eq("id", dealId)
    .single();

  if (!deal) notFound();

  const [{ data: offers }, { data: listingAgent }] = await Promise.all([
    supabase
      .from("offers")
      .select("*")
      .eq("deal_id", dealId)
      .order("round_number", { ascending: true }),
    deal.properties?.listing_agent_id
      ? supabase
          .from("listing_agents")
          .select("*")
          .eq("id", deal.properties.listing_agent_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const property = deal.properties as any;
  const buyer = deal.buyers as any;
  const isUnderContract = UNDER_CONTRACT_STAGES.includes(deal.stage);
  const contingencies = (deal.contingencies ?? {}) as Record<string, string>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/app/deals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Deals
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{property?.address}</h1>
          <p className="text-sm text-muted-foreground">
            {buyer?.full_name}
            {" · "}${property?.listing_price?.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="py-1 px-3">
            {deal.stage.replace(/_/g, " ")}
          </Badge>
          {deal.deal_probability != null && (
            <div className="text-right">
              <span className="text-xl font-bold">{deal.deal_probability}%</span>
              <p className="text-xs text-muted-foreground">probability</p>
            </div>
          )}
        </div>
      </div>

      {/* Stage manager */}
      <DealStageManager dealId={deal.id} currentStage={deal.stage} />

      {/* Risk signals */}
      <DealRiskSignals dealId={deal.id} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="offers">
            Offers ({offers?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          {isUnderContract && (
            <TabsTrigger value="contract">Contract</TabsTrigger>
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Property</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>{property?.address}</p>
                <p>
                  ${property?.listing_price?.toLocaleString()} · {property?.beds}/
                  {property?.baths} · {property?.sqft?.toLocaleString()} sqft
                </p>
                {property?.year_built && <p>Built {property.year_built}</p>}
                {property?.days_on_market != null && (
                  <p>{property.days_on_market} days on market</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deal Status</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {deal.current_offer_price && (
                  <p>
                    Current offer: $
                    {deal.current_offer_price.toLocaleString()}
                  </p>
                )}
                {deal.agreed_price && (
                  <p>
                    Agreed price: ${deal.agreed_price.toLocaleString()}
                  </p>
                )}
                {deal.contract_date && (
                  <p>
                    Contract:{" "}
                    {new Date(deal.contract_date).toLocaleDateString()}
                  </p>
                )}
                {deal.closing_date && (
                  <p>
                    Closing:{" "}
                    {new Date(deal.closing_date).toLocaleDateString()}
                  </p>
                )}
                {deal.earnest_money && (
                  <p>
                    Earnest money: ${deal.earnest_money.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Listing agent info */}
          {listingAgent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Listing Agent</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{listingAgent.name}</p>
                {listingAgent.brokerage && <p>{listingAgent.brokerage}</p>}
                {listingAgent.avg_list_to_sale_ratio != null && (
                  <p>
                    Avg list-to-sale ratio:{" "}
                    {(listingAgent.avg_list_to_sale_ratio * 100).toFixed(1)}%
                  </p>
                )}
                {listingAgent.avg_counter_rounds != null && (
                  <p>
                    Avg counter rounds: {listingAgent.avg_counter_rounds}
                  </p>
                )}
                {listingAgent.avg_days_on_market != null && (
                  <p>Avg DOM: {listingAgent.avg_days_on_market} days</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contract Timeline on Overview when under contract */}
          {isUnderContract && (
            <ContractTimeline
              contractDate={deal.contract_date}
              closingDate={deal.closing_date}
              contingencies={contingencies}
            />
          )}
        </TabsContent>

        {/* Offers */}
        <TabsContent value="offers" className="space-y-3 mt-4">
          <AddOfferForm dealId={deal.id} />

          {!offers || offers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No offers recorded yet. Add one above.
            </p>
          ) : (
            offers.map((offer: any) => {
              const analysis = (offer.ai_analysis || {}) as Record<
                string,
                unknown
              >;
              return (
                <Card key={offer.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            Round {offer.round_number}
                          </Badge>
                          <Badge>
                            {offer.offer_type.replace(/_/g, " ")}
                          </Badge>
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
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(offer.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    {analysis.strategy_recommendation ? (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-xs font-medium mb-1">AI Analysis</p>
                        <p className="text-sm">
                          {String(analysis.strategy_recommendation)}
                        </p>
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

        {/* Contract Tab */}
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
