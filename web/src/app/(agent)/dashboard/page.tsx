import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserPlus,
  AlertCircle,
  Briefcase,
  CheckCircle,
  Users,
  Building2,
  TrendingUp,
  Clock,
  Phone,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient() as any;

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
    { data: closedDeals },
    { data: actionItems },
    { data: runningTasks },
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
      .select("*", { count: "exact" })
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
  ]);

  const temperatureCounts = {
    hot: buyers?.filter((b) => b.temperature === "hot").length ?? 0,
    warm: buyers?.filter((b) => b.temperature === "warm").length ?? 0,
    cool: buyers?.filter((b) => b.temperature === "cool").length ?? 0,
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
                <p className="text-xs text-muted-foreground">Active Buyers</p>
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
                <p className="text-2xl font-bold">{activeDeals?.length ?? 0}</p>
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
                <p className="text-2xl font-bold">{closedDeals?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Closed Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Leads section */}
      {(draftLeadCount ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                New Leads
                <Badge variant="destructive">{draftLeadCount}</Badge>
              </CardTitle>
              <Link href="/leads">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            <CardDescription>
              Review and confirm new leads to start researching
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {draftLeads?.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        lead.confidence === "high"
                          ? "default"
                          : lead.confidence === "medium"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {lead.confidence}
                    </Badge>
                    <div>
                      <p className="font-medium">
                        {lead.name || "Unknown Contact"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {lead.source === "call" && (
                          <Phone className="h-3 w-3" />
                        )}
                        via {lead.source} &middot;{" "}
                        {new Date(lead.detected_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/leads/${lead.id}`}>
                      <Button size="sm" variant="default">
                        Review
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {actionItems?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
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
          {(!activeDeals || activeDeals.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No active deals yet. Confirm a lead and start researching properties.
            </p>
          ) : (
            <div className="space-y-2">
              {activeDeals.map((deal: any) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{deal.buyers?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.properties?.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {deal.stage.replace(/_/g, " ")}
                    </Badge>
                    {deal.deal_probability && (
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

      {/* Active Buyers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client Portfolio
            </CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {temperatureCounts.hot} hot
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                {temperatureCounts.warm} warm
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {temperatureCounts.cool} cool
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(!buyers || buyers.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No active buyers yet.{" "}
              <Link href="/leads" className="text-primary hover:underline">
                Add a lead
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {buyers.map((buyer) => (
                <Link
                  key={buyer.id}
                  href={`/buyers/${buyer.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{buyer.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      via {buyer.source}
                      {buyer.last_activity_at &&
                        ` · active ${new Date(
                          buyer.last_activity_at
                        ).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      buyer.temperature === "hot"
                        ? "destructive"
                        : buyer.temperature === "warm"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {buyer.temperature}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              {runningTasks?.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
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
                    variant={task.status === "running" ? "default" : "secondary"}
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
