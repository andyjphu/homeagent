import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug } from "lucide-react";
import { ScanButton } from "@/components/email/scan-button";
import { ComposeButton } from "@/components/email/compose-button";
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
        <h1 className="text-2xl font-bold">Email</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Connect Gmail</h2>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Connect your Gmail to view emails and optionally classify them with AI.
            </p>
            <a href="/api/email/connect">
              <Button>Connect Gmail</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email</h1>
          <p className="text-sm text-muted-foreground">
            Gmail connected
            {agent.gmail_last_scan_at && (
              <> &middot; Last classified: {new Date(agent.gmail_last_scan_at).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <ComposeButton />
          <ScanButton />
        </div>
      </div>

      <EmailInbox />
    </div>
  );
}
