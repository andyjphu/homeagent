import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InviteAgentForm } from "@/components/team/invite-agent-form";

export default async function TeamAgentsPage() {
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

  // Get all team members with detailed stats
  const { data: teamMembers } = await admin
    .from("brokerage_agents")
    .select("agent_id, role, joined_at, agents(id, full_name, email, phone)")
    .eq("brokerage_id", agent.brokerage_id);

  const agentDetails = await Promise.all(
    (teamMembers || []).map(async (m: any) => {
      const info = m.agents as any;
      const [
        { count: activeDeals },
        { count: closedDeals },
        { count: totalDeals },
        { count: activeBuyers },
        { count: briefs },
        { data: recentActivity },
      ] = await Promise.all([
        admin.from("deals").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id).not("stage", "in", '("closed","dead")'),
        admin.from("deals").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id).eq("stage", "closed"),
        admin.from("deals").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id),
        admin.from("buyers").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id).eq("is_active", true),
        admin.from("research_briefs").select("*", { count: "exact", head: true }).eq("agent_id", m.agent_id).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        admin.from("activity_feed").select("occurred_at").eq("agent_id", m.agent_id).order("occurred_at", { ascending: false }).limit(1),
      ]);

      return {
        id: m.agent_id,
        name: info?.full_name || "Unknown",
        email: info?.email || "",
        phone: info?.phone || null,
        role: m.role,
        joinedAt: m.joined_at,
        activeDeals: activeDeals || 0,
        closedDeals: closedDeals || 0,
        totalDeals: totalDeals || 0,
        conversionRate: totalDeals && totalDeals > 0 ? Math.round(((closedDeals || 0) / totalDeals) * 100) : 0,
        activeBuyers: activeBuyers || 0,
        briefsThisMonth: briefs || 0,
        lastActivity: recentActivity?.[0]?.occurred_at || null,
      };
    })
  );

  // Get pending invites
  const { data: pendingInvites } = await admin
    .from("brokerage_invites")
    .select("id, email, invite_code, created_at, expires_at")
    .eq("brokerage_id", agent.brokerage_id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/team">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Team Agents</h1>
      </div>

      {/* Invite form */}
      <InviteAgentForm />

      {/* Pending invites */}
      {pendingInvites && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvites.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {new Date(inv.created_at).toLocaleDateString()} · Expires{" "}
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent list */}
      <div className="space-y-3">
        {agentDetails.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{a.name}</p>
                    <Badge variant={a.role === "admin" ? "default" : "outline"}>
                      {a.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.email}</p>
                  {a.phone && (
                    <p className="text-sm text-muted-foreground">{a.phone}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Joined {new Date(a.joinedAt).toLocaleDateString()}
                    {a.lastActivity && (
                      <> · Last active {new Date(a.lastActivity).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="text-right text-sm space-y-1">
                  <p>
                    <strong>{a.activeDeals}</strong> active deals
                  </p>
                  <p>
                    <strong>{a.activeBuyers}</strong> buyers
                  </p>
                  <p>
                    <strong>{a.briefsThisMonth}</strong> briefs/mo
                  </p>
                  <p>
                    <strong>{a.conversionRate}%</strong> conversion
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
