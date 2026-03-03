import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgentSidebar } from "@/components/layout/agent-sidebar";
import { ActivityFeed } from "@/components/layout/activity-feed";
import { TopBar } from "@/components/layout/top-bar";

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
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    redirect("/login");
  }

  // Get unread action-required count for notification badge
  const { count: actionCount } = await supabase
    .from("activity_feed")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .eq("is_action_required", true)
    .eq("is_read", false);

  return (
    <div className="flex h-screen overflow-hidden">
      <AgentSidebar agentName={agent.full_name} agentEmail={agent.email} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          agentName={agent.full_name}
          agentEmail={agent.email}
          actionCount={actionCount ?? 0}
        />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
      <aside className="hidden xl:flex w-80 border-l bg-card shrink-0">
        <ActivityFeed agentId={agent.id} />
      </aside>
    </div>
  );
}
