import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Mail, CalendarDays, Zap } from "lucide-react";
import { GmailConnectButton } from "@/components/email/gmail-connect-button";
import { CalendarConnectButton } from "@/components/calendar/calendar-connect-button";

function StatusBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Connected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <XCircle className="h-3 w-3" />
      Not connected
    </Badge>
  );
}

export default async function ConnectionsPage() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("gmail_connected, gmail_last_scan_at, calendar_connected")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  const lastScan = agent.gmail_last_scan_at
    ? new Date(agent.gmail_last_scan_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Connections</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your tools so FoyerFind can work in the background.
        </p>
      </div>

      {/* Gmail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Gmail
          </CardTitle>
          <CardDescription>
            We watch your inbox for property addresses, buyer conversations, and listing updates.
            All outbound goes to drafts — you review before anything sends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <StatusBadge connected={agent.gmail_connected} />
              {agent.gmail_connected && lastScan && (
                <p className="text-xs text-muted-foreground">Last scan: {lastScan}</p>
              )}
            </div>
            <GmailConnectButton isConnected={agent.gmail_connected} />
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Sync deal deadlines and showing schedules with your calendar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <StatusBadge connected={agent.calendar_connected} />
            <CalendarConnectButton isConnected={agent.calendar_connected} />
          </div>
        </CardContent>
      </Card>

      {/* Future integrations placeholder */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            More integrations coming
          </CardTitle>
          <CardDescription>
            MLS API feeds, Twilio SMS for buyer feedback, and more — coming soon.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
