import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  DollarSign,
  FileCheck,
  BarChart3,
  Settings,
} from "lucide-react";

export default async function TeamOverviewPage() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id, brokerage_id")
    .eq("user_id", user.id)
    .single();
  if (!agent?.brokerage_id) redirect("/app/clients");

  // Check admin
  const { data: membership } = await admin
    .from("brokerage_agents")
    .select("role")
    .eq("brokerage_id", agent.brokerage_id)
    .eq("agent_id", agent.id)
    .single();
  if (membership?.role !== "admin") redirect("/app/clients");

  // Get brokerage info
  const { data: brokerage } = await admin
    .from("brokerages")
    .select("name")
    .eq("id", agent.brokerage_id)
    .single();

  // Get team agents
  const { data: teamMembers } = await admin
    .from("brokerage_agents")
    .select("agent_id, role, agents(id, full_name, email)")
    .eq("brokerage_id", agent.brokerage_id);

  const agentIds = (teamMembers || []).map((m: any) => m.agent_id);

  // Aggregate stats
  const [
    { count: totalDeals },
    { data: activeDeals },
    { count: totalBuyers },
    { count: briefsThisMonth },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .in("agent_id", agentIds)
      .neq("stage", "dead"),
    supabase
      .from("deals")
      .select("agreed_price, current_offer_price")
      .in("agent_id", agentIds)
      .not("stage", "in", '("closed","dead")'),
    supabase
      .from("buyers")
      .select("*", { count: "exact", head: true })
      .in("agent_id", agentIds)
      .eq("is_active", true),
    supabase
      .from("research_briefs")
      .select("*", { count: "exact", head: true })
      .in("agent_id", agentIds)
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const pipelineValue = (activeDeals || []).reduce((sum: number, d: any) => {
    return sum + (d.agreed_price || d.current_offer_price || 0);
  }, 0);

  // Per-agent stats
  const agentStats = await Promise.all(
    (teamMembers || []).map(async (m: any) => {
      const agentInfo = m.agents as any;
      const [
        { count: deals },
        { count: buyers },
        { count: briefs },
        { data: closedDeals },
        { count: totalAgentDeals },
      ] = await Promise.all([
        admin.from("deals").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id).not("stage", "in", '("closed","dead")'),
        admin.from("buyers").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id).eq("is_active", true),
        admin.from("research_briefs").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        admin.from("deals").select("id").eq("agent_id", m.agent_id).eq("stage", "closed"),
        admin.from("deals").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id),
      ]);

      const conversionRate = totalAgentDeals && totalAgentDeals > 0
        ? Math.round(((closedDeals?.length || 0) / totalAgentDeals) * 100)
        : 0;

      return {
        id: m.agent_id,
        name: agentInfo?.full_name || "Unknown",
        email: agentInfo?.email || "",
        role: m.role,
        activeDeals: deals || 0,
        activeBuyers: buyers || 0,
        briefsThisMonth: briefs || 0,
        conversionRate,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{brokerage?.name} — Team</h1>
          <p className="text-muted-foreground">
            Brokerage overview and management
          </p>
        </div>
        <Link href="/team/settings">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Quick nav */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/team/agents">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1" /> Agents
          </Button>
        </Link>
        <Link href="/team/compliance">
          <Button variant="outline" size="sm">
            <FileCheck className="h-4 w-4 mr-1" /> Compliance
          </Button>
        </Link>
        <Link href="/team/analytics">
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-1" /> Analytics
          </Button>
        </Link>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{agentIds.length}</p>
                <p className="text-sm text-muted-foreground">Total Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{totalDeals || 0}</p>
                <p className="text-sm text-muted-foreground">Active Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">
                  ${pipelineValue.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileCheck className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{briefsThisMonth || 0}</p>
                <p className="text-sm text-muted-foreground">
                  Briefs This Month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent roster */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium text-right">Active Deals</th>
                  <th className="pb-2 font-medium text-right">Buyers</th>
                  <th className="pb-2 font-medium text-right">Briefs/Mo</th>
                  <th className="pb-2 font-medium text-right">Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="py-2">
                      <Badge variant={a.role === "admin" ? "default" : "outline"}>
                        {a.role}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">{a.activeDeals}</td>
                    <td className="py-2 text-right">{a.activeBuyers}</td>
                    <td className="py-2 text-right">{a.briefsThisMonth}</td>
                    <td className="py-2 text-right">{a.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
