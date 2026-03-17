import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  CheckCircle,
  XCircle,
  Phone,
  Cpu,
  MapPin,
  Brain,
  Bell,
  Shield,
  Zap,
  CalendarDays,
} from "lucide-react";
import { GmailConnectButton } from "@/components/email/gmail-connect-button";
import { CalendarConnectButton } from "@/components/calendar/calendar-connect-button";
import { CalendarSettings } from "@/components/calendar/calendar-settings";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { VoiceAiStatus } from "@/components/settings/voice-ai-status";
import { MigrationBanner } from "@/components/settings/migration-banner";
import type { AgentPreferences } from "@/types/database";
import { DEFAULT_PREFERENCES } from "@/types/database";

function StatusBadge({ connected, label }: { connected: boolean; label?: string }) {
  if (connected) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        {label || "Connected"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <XCircle className="h-3 w-3" />
      {label || "Not configured"}
    </Badge>
  );
}

function AlwaysAvailableBadge() {
  return (
    <Badge variant="secondary" className="gap-1">
      <CheckCircle className="h-3 w-3" />
      Always available
    </Badge>
  );
}

export default async function SettingsPage() {
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

  // Check for pending database migrations
  const admin = createAdminClient() as any;
  const pendingMigrations: string[] = [];

  // Check enrichment_data column
  const { error: enrichColErr } = await admin
    .from("properties")
    .select("enrichment_data")
    .limit(0);
  if (enrichColErr?.message?.includes("does not exist")) {
    pendingMigrations.push("enrichment_data");
  }

  // Check enrichment_cache table
  const { error: cacheTableErr } = await admin
    .from("enrichment_cache")
    .select("id")
    .limit(0);
  if (cacheTableErr?.message?.includes("enrichment_cache")) {
    pendingMigrations.push("enrichment_cache");
  }

  // Check environment variables server-side
  const envStatus = {
    // Voice AI
    vapiKey: !!process.env.VAPI_API_KEY,
    retellKey: !!process.env.RETELL_API_KEY,
    // Enrichment
    walkScore: !!process.env.WALKSCORE_API_KEY,
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    census: !!process.env.CENSUS_API_KEY,
    airNow: !!process.env.AIRNOW_API_KEY,
    // LLM
    cerebras: !!process.env.CEREBRAS_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };

  const voiceAiConnected = envStatus.vapiKey || envStatus.retellKey;
  const anyEnrichmentConfigured = envStatus.walkScore || envStatus.googleMaps || envStatus.census || envStatus.airNow;
  const anyLlmConfigured = envStatus.cerebras || envStatus.gemini;

  const preferences: AgentPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(agent.notification_preferences as Partial<AgentPreferences> || {}),
  };

  // Format last scan time
  const lastScanTime = agent.gmail_last_scan_at
    ? new Date(agent.gmail_last_scan_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Database Migration Banner */}
      {pendingMigrations.length > 0 && (
        <MigrationBanner
          pendingMigrations={pendingMigrations}
          projectRef={process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").replace(".supabase.co", "")}
        />
      )}

      {/* 1. Agent Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Profile</CardTitle>
          <CardDescription>Your contact information and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm agent={agent} />
        </CardContent>
      </Card>

      {/* 2. Gmail Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Gmail Connection
          </CardTitle>
          <CardDescription>Connect Gmail to read emails, detect leads, and send on your behalf</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status</span>
                <StatusBadge connected={agent.gmail_connected} />
              </div>
              {agent.gmail_connected && lastScanTime && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {lastScanTime}
                </p>
              )}
            </div>
            <GmailConnectButton isConnected={agent.gmail_connected} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Google Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Sync deal deadlines to your calendar and show availability for showings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status</span>
                <StatusBadge connected={agent.calendar_connected} />
              </div>
            </div>
            <CalendarConnectButton isConnected={agent.calendar_connected} />
          </div>
          {agent.calendar_connected && (
            <>
              <Separator className="my-4" />
              <CalendarSettings
                workingHours={
                  (agent.calendar_working_hours as { start: string; end: string; days: number[] }) ?? {
                    start: "09:00",
                    end: "18:00",
                    days: [1, 2, 3, 4, 5, 6],
                  }
                }
                autoCreateEvents={agent.calendar_auto_create_events ?? true}
                showAvailability={agent.calendar_show_availability ?? true}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. Voice AI Receptionist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Voice AI Receptionist
          </CardTitle>
          <CardDescription>
            AI-powered phone receptionist that handles incoming calls and captures leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <StatusBadge connected={voiceAiConnected} />
          </div>

          {voiceAiConnected ? (
            <>
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span>{envStatus.vapiKey ? "Vapi" : "Retell"}</span>
                </div>
              </div>
              <VoiceAiStatus />
              <Separator />
              <PreferencesForm preferences={preferences} section="voice_ai" />
            </>
          ) : (
            <div className="rounded-lg border p-3 bg-muted/50 text-sm">
              <p className="text-muted-foreground">
                Connect a Voice AI provider (Vapi or Retell) to enable an AI phone receptionist
                that handles incoming calls when you&apos;re unavailable. The AI captures caller details
                and automatically creates leads in your pipeline.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Configure <code className="text-xs bg-muted px-1 rounded">VAPI_API_KEY</code> or{" "}
                <code className="text-xs bg-muted px-1 rounded">RETELL_API_KEY</code> in your environment to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Data Enrichment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Data Enrichment
          </CardTitle>
          <CardDescription>
            External data sources for property enrichment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1">
              <span>Walk Score</span>
              <StatusBadge connected={envStatus.walkScore} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Google Maps (Amenities)</span>
              <StatusBadge connected={envStatus.googleMaps} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span>FEMA Flood Data</span>
              <AlwaysAvailableBadge />
            </div>
            <div className="flex items-center justify-between py-1">
              <span>NCES Schools</span>
              <AlwaysAvailableBadge />
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Census Demographics</span>
              <StatusBadge connected={envStatus.census} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span>AirNow (Air Quality)</span>
              <StatusBadge connected={envStatus.airNow} />
            </div>
          </div>

          {anyEnrichmentConfigured && (
            <>
              <Separator />
              <PreferencesForm preferences={preferences} section="enrichment" />
            </>
          )}

          {!anyEnrichmentConfigured && (
            <p className="text-xs text-muted-foreground pt-1">
              Configure API keys for enrichment providers to automatically fetch property data.
              FEMA and FCC data are always available (free, no key required).
            </p>
          )}
        </CardContent>
      </Card>

      {/* 5. LLM / AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Configuration
          </CardTitle>
          <CardDescription>
            AI features are optional enhancements. The app works fully without them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Fast Analysis (Cerebras)</span>
              </div>
              <StatusBadge connected={envStatus.cerebras} />
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Deep Analysis (Gemini)</span>
              </div>
              <StatusBadge connected={envStatus.gemini} />
            </div>
          </div>

          {anyLlmConfigured && (
            <>
              <Separator />
              <PreferencesForm preferences={preferences} section="ai" />
            </>
          )}

          {!anyLlmConfigured && (
            <p className="text-xs text-muted-foreground">
              No AI providers configured. Configure <code className="text-xs bg-muted px-1 rounded">CEREBRAS_API_KEY</code>{" "}
              or <code className="text-xs bg-muted px-1 rounded">GEMINI_API_KEY</code> to enable AI features.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 6. Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose which events generate alerts in your activity feed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm preferences={preferences} section="notifications" />
        </CardContent>
      </Card>

      {/* 7. Sign Out */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">
                Clears your session and returns to login
              </p>
            </div>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
