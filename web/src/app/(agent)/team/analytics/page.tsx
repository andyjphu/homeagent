import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function TeamAnalyticsPage() {
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

  const { data: membership } = await admin
    .from("brokerage_agents")
    .select("role")
    .eq("brokerage_id", agent.brokerage_id)
    .eq("agent_id", agent.id)
    .single();
  if (membership?.role !== "admin") redirect("/app/clients");

  // Get team agents
  const { data: teamMembers } = await admin
    .from("brokerage_agents")
    .select("agent_id, agents(full_name)")
    .eq("brokerage_id", agent.brokerage_id);
  const agentIds = (teamMembers || []).map((m: any) => m.agent_id);

  // Get all deals for the team
  const { data: allDeals } = await admin
    .from("deals")
    .select("id, agent_id, stage, agreed_price, created_at, closed_at")
    .in("agent_id", agentIds);

  const deals = allDeals || [];
  const closedDeals = deals.filter((d: any) => d.stage === "closed");
  const totalDeals = deals.length;

  // Aggregate metrics
  const conversionRate =
    totalDeals > 0
      ? Math.round((closedDeals.length / totalDeals) * 100)
      : 0;

  const avgDealValue =
    closedDeals.length > 0
      ? Math.round(
          closedDeals.reduce((s: number, d: any) => s + (d.agreed_price || 0), 0) /
            closedDeals.length
        )
      : 0;

  // Avg days to close
  const daysToClose = closedDeals
    .filter((d: any) => d.closed_at && d.created_at)
    .map((d: any) => {
      const created = new Date(d.created_at).getTime();
      const closed = new Date(d.closed_at).getTime();
      return Math.round((closed - created) / (1000 * 60 * 60 * 24));
    });
  const avgDaysToClose =
    daysToClose.length > 0
      ? Math.round(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length)
      : 0;

  // Per-agent breakdown
  const agentBreakdown = (teamMembers || []).map((m: any) => {
    const agentDeals = deals.filter((d: any) => d.agent_id === m.agent_id);
    const agentClosed = agentDeals.filter((d: any) => d.stage === "closed");
    const agentDays = agentClosed
      .filter((d: any) => d.closed_at && d.created_at)
      .map((d: any) => {
        const created = new Date(d.created_at).getTime();
        const closed = new Date(d.closed_at).getTime();
        return Math.round((closed - created) / (1000 * 60 * 60 * 24));
      });

    return {
      name: (m.agents as any)?.full_name || "Unknown",
      totalDeals: agentDeals.length,
      closedDeals: agentClosed.length,
      conversionRate:
        agentDeals.length > 0
          ? Math.round((agentClosed.length / agentDeals.length) * 100)
          : 0,
      avgDealValue:
        agentClosed.length > 0
          ? Math.round(
              agentClosed.reduce((s: number, d: any) => s + (d.agreed_price || 0), 0) /
                agentClosed.length
            )
          : 0,
      avgDaysToClose:
        agentDays.length > 0
          ? Math.round(agentDays.reduce((a, b) => a + b, 0) / agentDays.length)
          : 0,
    };
  });

  // Monthly closed deals (last 6 months)
  const now = new Date();
  const monthlyData: { month: string; count: number; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthLabel = d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    const monthDeals = closedDeals.filter((deal: any) => {
      const closedDate = new Date(deal.closed_at);
      return closedDate >= d && closedDate < nextMonth;
    });
    monthlyData.push({
      month: monthLabel,
      count: monthDeals.length,
      value: monthDeals.reduce(
        (s: number, deal: any) => s + (deal.agreed_price || 0),
        0
      ),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/team">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Team Analytics</h1>
      </div>

      {/* Aggregate metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalDeals}</p>
            <p className="text-sm text-muted-foreground">Total Deals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{conversionRate}%</p>
            <p className="text-sm text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">${avgDealValue.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Avg Deal Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{avgDaysToClose}</p>
            <p className="text-sm text-muted-foreground">Avg Days to Close</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly deals table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals Closed Per Month</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium text-right">Deals Closed</th>
                <th className="pb-2 font-medium text-right">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m) => (
                <tr key={m.month} className="border-b last:border-0">
                  <td className="py-2">{m.month}</td>
                  <td className="py-2 text-right">{m.count}</td>
                  <td className="py-2 text-right">
                    ${m.value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Per-agent breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Agent Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Closed</th>
                  <th className="pb-2 font-medium text-right">Conv.</th>
                  <th className="pb-2 font-medium text-right">Avg Value</th>
                  <th className="pb-2 font-medium text-right">Avg Days</th>
                </tr>
              </thead>
              <tbody>
                {agentBreakdown.map((a) => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="py-2 font-medium">{a.name}</td>
                    <td className="py-2 text-right">{a.totalDeals}</td>
                    <td className="py-2 text-right">{a.closedDeals}</td>
                    <td className="py-2 text-right">{a.conversionRate}%</td>
                    <td className="py-2 text-right">
                      ${a.avgDealValue.toLocaleString()}
                    </td>
                    <td className="py-2 text-right">{a.avgDaysToClose}</td>
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
