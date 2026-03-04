import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Building2, ClipboardList } from "lucide-react";
import Link from "next/link";
import { FilterPanel } from "@/components/dashboard/filter-panel";
import { DealTimeline } from "@/components/dashboard/deal-timeline";
import { PropertyList } from "@/components/dashboard/property-list";

function PropertyListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border bg-card overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

async function PropertySection({
  buyerId,
  dashboardToken,
}: {
  buyerId: string;
  dashboardToken: string;
}) {
  const supabase = createAdminClient() as any;

  // Fetch scored properties
  const { data: scores } = await supabase
    .from("buyer_property_scores")
    .select("*, properties(*)")
    .eq("buyer_id", buyerId)
    .eq("is_sent_to_buyer", true)
    .order("match_score", { ascending: false });

  // Fetch buyer comments
  const { data: comments } = await supabase
    .from("buyer_comments")
    .select("*")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  const commentsByProperty = (comments ?? []).reduce(
    (acc: Record<string, any[]>, c: any) => {
      if (!acc[c.property_id]) acc[c.property_id] = [];
      acc[c.property_id].push(c);
      return acc;
    },
    {} as Record<string, any[]>
  );

  if (!scores || scores.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="font-medium mb-1">No properties yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your agent is researching properties for you. You&apos;ll receive
            an email when your shortlist is ready.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <PropertyList
      scores={scores}
      commentsByProperty={commentsByProperty}
      dashboardToken={dashboardToken}
    />
  );
}

export default async function BuyerDashboardPage({
  params,
}: {
  params: Promise<{ dashboardToken: string }>;
}) {
  const { dashboardToken } = await params;
  const supabase = createAdminClient() as any;

  // Validate token and get buyer with agent info
  const { data: buyer } = await supabase
    .from("buyers")
    .select("*, agents(full_name)")
    .eq("dashboard_token", dashboardToken)
    .single();

  if (!buyer) notFound();

  // Update visit count and log dashboard view for agent intelligence
  await supabase
    .from("buyers")
    .update({
      last_dashboard_visit_at: new Date().toISOString(),
      dashboard_visit_count: (buyer.dashboard_visit_count ?? 0) + 1,
    })
    .eq("id", buyer.id);

  await createActivityEntry(
    buyer.agent_id,
    "dashboard_viewed",
    `${buyer.full_name} viewed their dashboard`,
    `Visit #${(buyer.dashboard_visit_count ?? 0) + 1}`,
    undefined,
    { buyerId: buyer.id }
  );

  // Fetch deals at negotiating stage or later — buyers see progress once things get serious
  const VISIBLE_DEAL_STAGES = [
    "negotiating",
    "under_contract",
    "inspection",
    "appraisal",
    "closing",
    "closed",
  ];
  const { data: deals } = await supabase
    .from("deals")
    .select("*, properties(*)")
    .eq("buyer_id", buyer.id)
    .in("stage", VISIBLE_DEAL_STAGES);

  const intent = (buyer.intent_profile || {}) as any;
  const agentName = (buyer.agents as any)?.full_name;

  // Format last updated timestamp
  const lastUpdated = buyer.updated_at
    ? new Date(buyer.updated_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header with subtle gradient accent */}
      <header className="border-b bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
        <div className="relative max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">HomeAgent</p>
                <p className="text-xs text-muted-foreground">
                  Your Home Search
                  {agentName && (
                    <>
                      {" "}
                      &middot; curated by{" "}
                      <span className="text-foreground">{agentName}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                Welcome, {buyer.full_name}
              </p>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  Last updated {lastUpdated}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        {/* Deal timeline */}
        {deals && deals.length > 0 && <DealTimeline deal={deals[0]} />}

        {/* Intake CTA banner - shown when buyer hasn't completed intake */}
        {!intent.timeline && !intent.preferred_areas?.length && !intent.priorities_ranked?.length && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Help us find your perfect home</p>
                  <p className="text-xs text-muted-foreground">
                    Complete a quick questionnaire so {agentName || "your agent"} can start searching for you.
                  </p>
                </div>
              </div>
              <Link href={`/d/${dashboardToken}/intake`}>
                <Button size="sm">Get Started</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Filter panel */}
        <FilterPanel
          dashboardToken={dashboardToken}
          intentProfile={intent}
        />

        {/* Property list */}
        <div>
          <h2 className="text-xl font-bold mb-4">Your Properties</h2>
          <Suspense fallback={<PropertyListSkeleton />}>
            <PropertySection
              buyerId={buyer.id}
              dashboardToken={dashboardToken}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
