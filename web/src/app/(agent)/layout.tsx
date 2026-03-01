import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgentSidebar } from "@/components/layout/agent-sidebar";
import { ActivityFeed } from "@/components/layout/activity-feed";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient() as any;

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

  return (
    <div className="flex h-screen overflow-hidden">
      <AgentSidebar agentName={agent.full_name} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-6">{children}</div>
      </main>
      <aside className="hidden xl:flex w-80 border-l bg-card">
        <ActivityFeed agentId={agent.id} />
      </aside>
    </div>
  );
}
