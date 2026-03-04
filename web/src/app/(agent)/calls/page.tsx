import { createClient } from "@/lib/supabase/server";
import { CallUploadDialog } from "@/components/calls/call-upload-dialog";
import { CallList } from "@/components/calls/call-list";

export default async function CallsPage() {
  const supabase = await createClient() as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  // Fetch calls and buyers in parallel
  const [callsResult, buyersResult] = await Promise.all([
    supabase
      .from("communications")
      .select("*, buyers(full_name)")
      .eq("agent_id", agent.id)
      .eq("type", "call")
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("buyers")
      .select("id, full_name")
      .eq("agent_id", agent.id)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const calls = callsResult.data || [];
  const buyers = buyersResult.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Call Log</h1>
          <p className="text-muted-foreground">
            Record, transcribe, and extract leads from calls
          </p>
        </div>
        <CallUploadDialog agentId={agent.id} buyers={buyers} />
      </div>

      <CallList calls={calls} />
    </div>
  );
}
