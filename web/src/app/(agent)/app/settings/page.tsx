import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  CheckCircle,
  XCircle,
  CalendarDays,
  Palette,
  Mic,
} from "lucide-react";
import { GmailConnectButton } from "@/components/email/gmail-connect-button";
import { CalendarConnectButton } from "@/components/calendar/calendar-connect-button";
import { ProfileForm } from "@/components/settings/profile-form";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { VoiceToneForm } from "@/components/settings/voice-tone-form";
import { BrandSettingsForm } from "@/components/settings/brand-settings-form";

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

export default async function AppSettingsPage() {
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

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your contact information</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm agent={agent} />
        </CardContent>
      </Card>

      {/* Voice & Tone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice &amp; Tone
          </CardTitle>
          <CardDescription>
            How FoyerFind writes on your behalf — in drafts, research briefs, and buyer notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceToneForm currentTone={agent.voice_tone ?? "professional"} />
        </CardContent>
      </Card>

      {/* Brand Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Brand
          </CardTitle>
          <CardDescription>
            Logo and colors shown on your buyers&apos; portal pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandSettingsForm brandSettings={agent.brand_settings ?? {}} />
        </CardContent>
      </Card>

      {/* Gmail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Gmail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <StatusBadge connected={agent.gmail_connected} />
            <GmailConnectButton isConnected={agent.gmail_connected} />
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <StatusBadge connected={agent.calendar_connected} />
            <CalendarConnectButton isConnected={agent.calendar_connected} />
          </div>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">Clears your session</p>
            </div>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
