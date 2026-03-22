import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Mail, CalendarDays, Users, FileText, Zap } from "lucide-react";
import { GmailConnectButton } from "@/components/email/gmail-connect-button";
import { CalendarConnectButton } from "@/components/calendar/calendar-connect-button";
import { FUBConnectButton } from "@/components/integrations/fub-connect-button";
import { DotloopConnectButton } from "@/components/integrations/dotloop-connect-button";

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

function formatSyncTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ConnectionsPage() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, gmail_connected, gmail_last_scan_at, calendar_connected")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  // Fetch integration statuses
  const admin = createAdminClient() as any;
  const { data: integrations } = await admin
    .from("agent_integrations")
    .select("provider, is_active, last_sync_at, sync_errors")
    .eq("agent_id", agent.id);

  const integrationMap = new Map<string, {
    is_active: boolean;
    last_sync_at: string | null;
    sync_errors: unknown[];
  }>();
  for (const i of integrations ?? []) {
    integrationMap.set(i.provider, i);
  }

  const fub = integrationMap.get("followupboss");
  const dotloop = integrationMap.get("dotloop");

  const lastScan = formatSyncTime(agent.gmail_last_scan_at);

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

      {/* Follow Up Boss */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Follow Up Boss
          </CardTitle>
          <CardDescription>
            Sync contacts and push research briefs and deal updates to your FUB timeline.
            Find your API key in FUB under Admin &gt; API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <StatusBadge connected={!!fub?.is_active} />
              {fub?.is_active && fub.last_sync_at && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {formatSyncTime(fub.last_sync_at)}
                </p>
              )}
              {fub?.is_active && (fub.sync_errors as unknown[])?.length > 0 && (
                <p className="text-xs text-destructive">
                  {(fub.sync_errors as any[])[0]?.message}
                </p>
              )}
            </div>
            <FUBConnectButton
              isConnected={!!fub?.is_active}
              lastSyncAt={fub?.last_sync_at ?? null}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dotloop */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Dotloop
          </CardTitle>
          <CardDescription>
            Sync transaction loops and keep deal stages in sync between FoyerFind and Dotloop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <StatusBadge connected={!!dotloop?.is_active} />
              {dotloop?.is_active && dotloop.last_sync_at && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {formatSyncTime(dotloop.last_sync_at)}
                </p>
              )}
              {dotloop?.is_active && (dotloop.sync_errors as unknown[])?.length > 0 && (
                <p className="text-xs text-destructive">
                  {(dotloop.sync_errors as any[])[0]?.message}
                </p>
              )}
            </div>
            <DotloopConnectButton
              isConnected={!!dotloop?.is_active}
              lastSyncAt={dotloop?.last_sync_at ?? null}
            />
          </div>
        </CardContent>
      </Card>

      {/* Future integrations */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            More integrations coming
          </CardTitle>
          <CardDescription>
            ShowingTime, MLS API feeds, Outlook — coming soon.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
