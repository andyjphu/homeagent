import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  AlertCircle,
  Briefcase,
  CheckCircle,
  Users,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { NewLeadsSection } from "@/components/dashboard/new-leads-section";
import { ActiveBuyersSection } from "@/components/dashboard/active-buyers-section";
import {
  StatsRowSkeleton,
  LeadsSkeleton,
  BuyersSkeleton,
  DealsSkeleton,
} from "@/components/dashboard/dashboard-skeleton";

export default async function DashboardPage() {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  // Fetch dashboard data in parallel
  const [
    { data: draftLeads, count: draftLeadCount },
    { data: buyers },
    { data: activeDeals },
    { count: closedDealCount },
    { data: actionItems },
    { data: runningTasks },
    { data: propertyScores },
    { data: buyerDeals },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact" })
      .eq("agent_id", agent.id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("buyers")
      .select("*")
      .eq("agent_id", agent.id)
      .eq("is_active", true)
      .order("last_activity_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("deals")
      .select("*, buyers(*), properties(*)")
      .eq("agent_id", agent.id)
      .not("stage", "in", '("closed","dead")')
      .order("updated_at", { ascending: false }),
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("stage", "closed"),
    supabase
      .from("activity_feed")
      .select("*")
      .eq("agent_id", agent.id)
      .eq("is_action_required", true)
      .eq("is_read", false)
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase
      .from("agent_tasks")
      .select("*")
      .eq("agent_id", agent.id)
      .in("status", ["queued", "running"]),
    // Fetch property scores for counting per buyer
    supabase
      .from("buyer_property_scores")
      .select("buyer_id, is_sent_to_buyer")
      .eq("is_sent_to_buyer", true),
    // Fetch active deals for buyer deal stage
    supabase
      .from("deals")
      .select("buyer_id, stage")
      .eq("agent_id", agent.id)
      .not("stage", "in", '("closed","dead")'),
  ]);

  // Build buyer enrichment maps
  const propertyCountMap: Record<string, number> = {};
  propertyScores?.forEach((score: any) => {
    propertyCountMap[score.buyer_id] =
      (propertyCountMap[score.buyer_id] || 0) + 1;
  });

  const dealStageMap: Record<string, string> = {};
  buyerDeals?.forEach((deal: any) => {
    // Keep the most advanced deal stage per buyer
    if (!dealStageMap[deal.buyer_id]) {
      dealStageMap[deal.buyer_id] = deal.stage;
    }
  });

  // Enrich buyers with property count and deal stage
  const enrichedBuyers = (buyers || []).map((buyer: any) => ({
    ...buyer,
    property_count: propertyCountMap[buyer.id] || 0,
    deal_stage: dealStageMap[buyer.id] || null,
  }));

  const stageColors: Record<string, string> = {
    prospecting: "bg-blue-500/10 text-blue-700",
    touring: "bg-purple-500/10 text-purple-700",
    pre_offer: "bg-orange-500/10 text-orange-700",
    negotiating: "bg-amber-500/10 text-amber-700",
    under_contract: "bg-green-500/10 text-green-700",
    inspection: "bg-cyan-500/10 text-cyan-700",
    appraisal: "bg-teal-500/10 text-teal-700",
    closing: "bg-emerald-500/10 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {agent.full_name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening across your deals
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <UserPlus className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{draftLeadCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">New Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{buyers?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Briefcase className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {activeDeals?.length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Active Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{closedDealCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Closed Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Leads — interactive client component */}
      <NewLeadsSection
        leads={draftLeads || []}
        totalCount={draftLeadCount ?? 0}
      />

      {/* Action Required */}
      {(actionItems?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Action Required
              <Badge variant="secondary">{actionItems?.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actionItems?.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap ml-3">
                    {new Date(item.occurred_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Deals */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Active Deals
            </CardTitle>
            <Link href="/deals">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!activeDeals || activeDeals.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-sm mb-1">No active deals</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Deals appear here when you start working on a property for a
                buyer.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeDeals.map((deal: any) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {deal.buyers?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {deal.properties?.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${stageColors[deal.stage] || ""}`}
                    >
                      {deal.stage.replace(/_/g, " ")}
                    </Badge>
                    {deal.deal_probability != null && (
                      <span className="text-xs text-muted-foreground">
                        {deal.deal_probability}%
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Buyers — interactive client component */}
      <ActiveBuyersSection buyers={enrichedBuyers} />

      {/* Running Tasks */}
      {(runningTasks?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 animate-spin" />
              Running Research Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {runningTasks?.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {task.task_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started{" "}
                      {task.started_at
                        ? new Date(task.started_at).toLocaleTimeString()
                        : "queued"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      task.status === "running" ? "default" : "secondary"
                    }
                  >
                    {task.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
