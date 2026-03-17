import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, Mail } from "lucide-react";
import { ScanButton } from "@/components/email/scan-button";
import { GmailConnectButton } from "@/components/email/gmail-connect-button";
import Link from "next/link";

export default async function EmailPage() {
  const supabase = (await createClient()) as any;
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
        <h1 className="text-2xl font-bold">Email Integration</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Connect Gmail</h2>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Connect your Gmail to automatically detect potential leads from
              your inbox. FoyerFind scans for buying-intent emails and surfaces
              them on your Dashboard.
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Integration</h1>
        <p className="text-sm text-muted-foreground">
          Gmail connected — leads detected from your inbox appear on the
          Dashboard.
        </p>
      </div>

      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-sm">Gmail</span>
            </div>
            <GmailConnectButton isConnected={true} />
          </div>

          <ScanButton lastScanAt={agent.gmail_last_scan_at} />

          <p className="text-sm text-muted-foreground">
            Detected leads appear in the{" "}
            <Link href="/dashboard" className="text-primary hover:underline">
              New Leads section
            </Link>{" "}
            on your Dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
