import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { BuyerPropertyCard } from "@/components/dashboard/buyer-property-card";
import { FilterPanel } from "@/components/dashboard/filter-panel";

export default async function BuyerDashboardPage({
  params,
}: {
  params: Promise<{ dashboardToken: string }>;
}) {
  const { dashboardToken } = await params;
  const supabase = createAdminClient() as any;

  // Validate token and get buyer
  const { data: buyer } = await supabase
    .from("buyers")
    .select("*")
    .eq("dashboard_token", dashboardToken)
    .single();

  if (!buyer) notFound();

  // Update visit count
  await supabase
    .from("buyers")
    .update({
      last_dashboard_visit_at: new Date().toISOString(),
      dashboard_visit_count: buyer.dashboard_visit_count + 1,
    })
    .eq("id", buyer.id);

  // Fetch scored properties
  const { data: scores } = await supabase
    .from("buyer_property_scores")
    .select("*, properties(*)")
    .eq("buyer_id", buyer.id)
    .eq("is_sent_to_buyer", true)
    .order("match_score", { ascending: false });

  // Fetch buyer comments
  const { data: comments } = await supabase
    .from("buyer_comments")
    .select("*")
    .eq("buyer_id", buyer.id)
    .order("created_at", { ascending: false });

  // Fetch active deals
  const { data: deals } = await supabase
    .from("deals")
    .select("*, properties(*)")
    .eq("buyer_id", buyer.id)
    .not("stage", "in", '("closed","dead")');

  const intent = (buyer.intent_profile || {}) as any;
  const commentsByProperty = (comments ?? []).reduce(
    (acc: any, c: any) => {
      if (!acc[c.property_id]) acc[c.property_id] = [];
      acc[c.property_id].push(c);
      return acc;
    },
    {} as Record<string, any[]>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">HomeAgent AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, {buyer.full_name}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Active deal banner */}
        {deals && deals.length > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Active Deal</p>
                  <p className="text-sm text-muted-foreground">
                    {(deals[0] as any).properties?.address}
                  </p>
                </div>
                <Badge>{(deals[0] as any).stage?.replace(/_/g, " ")}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter panel */}
        <FilterPanel
          buyerId={buyer.id}
          dashboardToken={dashboardToken}
          intentProfile={intent}
        />

        {/* Property list */}
        <div>
          <h2 className="text-xl font-bold mb-4">
            Your Properties ({scores?.length ?? 0})
          </h2>

          {(!scores || scores.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Your agent is researching properties for you. Check back soon!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {scores.map((score: any, index: number) => (
                <BuyerPropertyCard
                  key={score.id}
                  score={score}
                  property={score.properties}
                  rank={index + 1}
                  comments={commentsByProperty[score.property_id] || []}
                  buyerId={buyer.id}
                  dashboardToken={dashboardToken}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
