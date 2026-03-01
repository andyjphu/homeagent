import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Plug } from "lucide-react";
import Link from "next/link";
import { ScanButton } from "@/components/email/scan-button";

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
            <Link href="/settings">
              <Button>Connect Gmail</Button>
            </Link>
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

      <div className="space-y-3">
        {(!communications || communications.length === 0) ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No emails analyzed yet. Run a scan to start.
              </p>
            </CardContent>
          </Card>
        ) : (
          communications.map((comm: any) => {
            const analysis = (comm.ai_analysis || {}) as any;
            return (
              <Card key={comm.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{comm.direction}</Badge>
                        {comm.classification && (
                          <Badge
                            variant={
                              comm.classification === "new_lead"
                                ? "destructive"
                                : comm.classification === "action_required"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {comm.classification.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {comm.buyers?.full_name && (
                          <span className="text-sm text-muted-foreground">
                            {comm.buyers.full_name}
                          </span>
                        )}
                      </div>
                      {comm.subject && (
                        <p className="font-medium">{comm.subject}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {comm.direction === "inbound"
                          ? `From: ${comm.from_address}`
                          : `To: ${comm.to_address}`}
                      </p>
                      {analysis.summary && (
                        <p className="text-sm bg-muted p-2 rounded mt-2">
                          {analysis.summary}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(comm.occurred_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
