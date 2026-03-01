import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, CheckCircle } from "lucide-react";
import { GmailConnectButton } from "@/components/email/gmail-connect-button";
import { ProfileForm } from "@/components/settings/profile-form";

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

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm agent={agent} />
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5" />
              <div>
                <p className="font-medium">Gmail</p>
                <p className="text-xs text-muted-foreground">
                  Read emails, detect leads, send on your behalf
                </p>
              </div>
            </div>
            <GmailConnectButton isConnected={agent.gmail_connected} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5" />
              <div>
                <p className="font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground">
                  Schedule tours, track deadlines
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              Coming Soon
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* LLM Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fast Analysis (Cerebras)</span>
            {process.env.CEREBRAS_API_KEY ? (
              <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Not configured</Badge>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deep Analysis (Gemini)</span>
            {process.env.GEMINI_API_KEY ? (
              <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Not configured</Badge>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Communication Tone</span>
            <span className="capitalize">{agent.communication_tone}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
