import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("gmail_connected")
    .eq("user_id", user.id)
    .single();

  if (!agent || !agent.gmail_connected) {
    redirect("/app/connections");
  }

  redirect("/app/clients");
}
