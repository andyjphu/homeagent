"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Handshake, AlertTriangle, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import type { DealStage } from "@/types/database";

const STAGE_CONFIG: { value: DealStage; label: string }[] = [
  { value: "prospecting", label: "Prospecting" },
  { value: "touring", label: "Touring" },
  { value: "pre_offer", label: "Pre-Offer" },
  { value: "negotiating", label: "Negotiating" },
  { value: "under_contract", label: "Under Contract" },
  { value: "inspection", label: "Inspection" },
  { value: "appraisal", label: "Appraisal" },
  { value: "closing", label: "Closing" },
];

function stageLabel(stage: string): string {
  return STAGE_CONFIG.find((s) => s.value === stage)?.label ?? stage.replace(/_/g, " ");
}

function daysInStage(stageEnteredAt: string | null): number {
  if (!stageEnteredAt) return 0;
  const entered = new Date(stageEnteredAt).getTime();
  return Math.floor((Date.now() - entered) / (1000 * 60 * 60 * 24));
}

function stageBadgeVariant(stage: string): "default" | "destructive" | "secondary" | "outline" {
  if (stage === "closing") return "destructive";
  if (["under_contract", "inspection", "appraisal"].includes(stage)) return "default";
  if (["negotiating", "pre_offer"].includes(stage)) return "secondary";
  return "outline";
}

export default function DealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient() as any;

  async function loadDeals() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!agent) return;

    const { data } = await supabase
      .from("deals")
      .select("*, buyers(full_name, email), properties(address, listing_price, zip)")
      .eq("agent_id", agent.id)
      .order("updated_at", { ascending: false });

    setDeals(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadDeals();
  }, []);

  const activeDeals = deals.filter((d) => !["closed", "dead"].includes(d.stage));
  const closedDeals = deals.filter((d) => d.stage === "closed");
  const deadDeals = deals.filter((d) => d.stage === "dead");

  // Group active deals by stage for pipeline view
  const grouped = new Map<string, any[]>();
  for (const stage of STAGE_CONFIG) {
    grouped.set(stage.value, []);
  }
  for (const deal of activeDeals) {
    const list = grouped.get(deal.stage);
    if (list) list.push(deal);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Deals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {loading
            ? "Loading..."
            : `${activeDeals.length} active, ${closedDeals.length} closed`}
        </p>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline ({activeDeals.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedDeals.length})</TabsTrigger>
          <TabsTrigger value="dead">Dead ({deadDeals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          {activeDeals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Handshake className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No active deals. Start by matching a buyer with a property.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {STAGE_CONFIG.map((stage) => {
                const stageDeals = grouped.get(stage.value) ?? [];
                if (stageDeals.length === 0) return null;
                return (
                  <div key={stage.value}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={stageBadgeVariant(stage.value)}>
                        {stage.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {stageDeals.length} deal{stageDeals.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {stageDeals.map((deal: any) => (
                        <DealCard key={deal.id} deal={deal} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed" className="mt-4 space-y-2">
          {closedDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No closed deals yet.
            </p>
          ) : (
            closedDeals.map((deal: any) => <DealCard key={deal.id} deal={deal} />)
          )}
        </TabsContent>

        <TabsContent value="dead" className="mt-4 space-y-2">
          {deadDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No dead deals.
            </p>
          ) : (
            deadDeals.map((deal: any) => <DealCard key={deal.id} deal={deal} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DealCard({ deal }: { deal: any }) {
  const buyer = deal.buyers;
  const property = deal.properties;
  const days = daysInStage(deal.stage_entered_at);

  return (
    <Link href={`/app/deals/${deal.id}`}>
      <div className="flex items-center justify-between px-4 py-3 border rounded-lg bg-card hover:bg-accent/30 transition-colors cursor-pointer">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {buyer?.full_name ?? "Unknown"}
            </span>
            <Badge variant="outline" className="text-xs">
              {stageLabel(deal.stage)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {property?.address ?? "No address"}
          </p>
        </div>
        <div className="flex items-center gap-4 ml-4 shrink-0">
          {deal.deal_probability != null && (
            <span className="text-sm font-semibold">{deal.deal_probability}%</span>
          )}
          {days > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {days}d
            </span>
          )}
          {deal.closing_date && !deal.closed_at && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(deal.closing_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
