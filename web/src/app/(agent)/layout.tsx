import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, full_name, email, gmail_connected")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppNav agentName={agent.full_name} agentEmail={agent.email} />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
