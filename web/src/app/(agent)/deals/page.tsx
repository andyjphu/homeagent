import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Handshake } from "lucide-react";
import Link from "next/link";

const STAGE_ORDER = [
  "prospecting",
  "touring",
  "pre_offer",
  "negotiating",
  "under_contract",
  "inspection",
  "appraisal",
  "closing",
];

export default async function DealsPage() {
  const supabase = await createClient() as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  const { data: deals } = await supabase
    .from("deals")
    .select("*, buyers(*), properties(*)")
    .eq("agent_id", agent.id)
    .order("updated_at", { ascending: false });

  const activeDeals = deals?.filter((d) => !["closed", "dead"].includes(d.stage)) ?? [];
  const closedDeals = deals?.filter((d) => d.stage === "closed") ?? [];
  const deadDeals = deals?.filter((d) => d.stage === "dead") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deals</h1>
        <p className="text-muted-foreground">
          {activeDeals.length} active, {closedDeals.length} closed
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeDeals.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedDeals.length})</TabsTrigger>
          <TabsTrigger value="dead">Dead ({deadDeals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeDeals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Handshake className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No active deals. Start by matching a buyer with a property.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeDeals.map((deal: any) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed" className="mt-4 space-y-3">
          {closedDeals.map((deal: any) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </TabsContent>

        <TabsContent value="dead" className="mt-4 space-y-3">
          {deadDeals.map((deal: any) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DealCard({ deal }: { deal: any }) {
  return (
    <Link href={`/deals/${deal.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{deal.buyers?.full_name}</h3>
                <Badge variant="outline">
                  {deal.stage.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {deal.properties?.address}
              </p>
              <p className="text-sm text-muted-foreground">
                ${deal.properties?.listing_price?.toLocaleString()}
                {deal.agreed_price &&
                  ` · Agreed: $${deal.agreed_price.toLocaleString()}`}
              </p>
            </div>
            <div className="text-right">
              {deal.deal_probability != null && (
                <div>
                  <span className="text-lg font-bold">
                    {deal.deal_probability}%
                  </span>
                  <p className="text-xs text-muted-foreground">probability</p>
                </div>
              )}
              {deal.closed_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Closed: {new Date(deal.closed_at).toLocaleDateString()}
                </p>
              )}
              {!deal.closed_at && deal.closing_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Close: {new Date(deal.closing_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
