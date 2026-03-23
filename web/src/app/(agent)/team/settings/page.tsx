import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrokerageSettingsForm } from "@/components/team/brokerage-settings-form";
import { TeamMemberManager } from "@/components/team/team-member-manager";

export default async function TeamSettingsPage() {
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

  const { data: brokerage } = await admin
    .from("brokerages")
    .select("*")
    .eq("id", agent.brokerage_id)
    .single();

  // Get team members
  const { data: teamMembers } = await admin
    .from("brokerage_agents")
    .select("agent_id, role, agents(full_name, email)")
    .eq("brokerage_id", agent.brokerage_id);

  const members = (teamMembers || []).map((m: any) => ({
    id: m.agent_id,
    name: (m.agents as any)?.full_name || "Unknown",
    email: (m.agents as any)?.email || "",
    role: m.role,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/team">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Brokerage Settings</h1>
      </div>

      <BrokerageSettingsForm
        name={brokerage?.name || ""}
        logoUrl={brokerage?.logo_url || ""}
        brandColors={(brokerage?.brand_colors || {}) as Record<string, string>}
        customDomain={brokerage?.custom_domain || ""}
      />

      <TeamMemberManager
        members={members}
        currentAgentId={agent.id}
      />

      {/* Custom domain instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Domain Setup</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">
            To use a custom domain for your buyer portals, add a CNAME record
            pointing to <code className="bg-muted px-1 rounded">portal.foyerfind.com</code>.
          </p>
          <div className="bg-muted p-3 rounded-lg font-mono text-xs">
            <p>Type: CNAME</p>
            <p>Name: {brokerage?.custom_domain || "portal.yourbrokerage.com"}</p>
            <p>Value: portal.foyerfind.com</p>
          </div>
          <p className="text-xs text-muted-foreground">
            After adding the CNAME, contact support to activate SSL for your domain.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
