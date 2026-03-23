import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppNav } from "@/components/layout/app-nav";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id, full_name, email, gmail_connected, brokerage_id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    redirect("/login");
  }

  // Fetch brokerage info if agent belongs to one
  let brokerageName: string | null = null;
  let brokerageLogoUrl: string | null = null;
  let isBrokerageAdmin = false;

  if (agent.brokerage_id) {
    const adminClient = createAdminClient() as any;
    const [{ data: brokerage }, { data: membership }] = await Promise.all([
      adminClient
        .from("brokerages")
        .select("name, logo_url")
        .eq("id", agent.brokerage_id)
        .single(),
      adminClient
        .from("brokerage_agents")
        .select("role")
        .eq("brokerage_id", agent.brokerage_id)
        .eq("agent_id", agent.id)
        .single(),
    ]);
    brokerageName = brokerage?.name || null;
    brokerageLogoUrl = brokerage?.logo_url || null;
    isBrokerageAdmin = membership?.role === "admin";
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppNav
        agentName={agent.full_name}
        agentEmail={agent.email}
        brokerageName={brokerageName}
        brokerageLogoUrl={brokerageLogoUrl}
        isBrokerageAdmin={isBrokerageAdmin}
      />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
