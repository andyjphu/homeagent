import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plug } from "lucide-react";
import { ScanButton } from "@/components/email/scan-button";
import { EmailInbox } from "@/components/email/email-inbox";

export default async function EmailPage() {
  const supabase = await createClient() as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  if (!agent.gmail_connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Email Intelligence</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Connect Gmail</h2>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Connect your Gmail to enable automatic lead detection, email
              analysis, and AI-drafted responses.
            </p>
            <a href="/api/email/connect">
              <Button>Connect Gmail</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: communications } = await supabase
    .from("communications")
    .select("*, buyers(full_name)")
    .eq("agent_id", agent.id)
    .eq("type", "email")
    .order("occurred_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Intelligence</h1>
          <p className="text-muted-foreground">
            Gmail connected &middot; Last scan:{" "}
            {agent.gmail_last_scan_at
              ? new Date(agent.gmail_last_scan_at).toLocaleString()
              : "never"}
          </p>
        </div>
        <ScanButton />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Inbox</h2>
        <EmailInbox />
      </div>

      {communications && communications.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Classified</h2>
          <div className="border rounded-lg divide-y">
            {communications.map((comm: any) => {
              const dateStr = new Date(comm.occurred_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });
              return (
                <div key={comm.id} className="flex items-center gap-3 px-3 py-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${comm.direction === "inbound" ? "bg-blue-500" : "bg-emerald-500"}`} />
                  {comm.classification && (
                    <Badge
                      variant={
                        comm.classification === "new_lead"
                          ? "destructive"
                          : comm.classification === "action_required"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px] px-1.5 py-0 shrink-0"
                    >
                      {comm.classification.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <span className="text-sm w-36 truncate shrink-0 text-muted-foreground">
                    {comm.direction === "inbound" ? comm.from_address : comm.to_address}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">
                    {comm.subject || "(no subject)"}
                  </span>
                  {comm.buyers?.full_name && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {comm.buyers.full_name}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
