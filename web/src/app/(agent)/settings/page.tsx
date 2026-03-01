import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Calendar, CheckCircle, XCircle } from "lucide-react";

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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input defaultValue={agent.full_name} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input defaultValue={agent.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input defaultValue={agent.phone || ""} placeholder="(214) 555-0123" />
            </div>
            <div className="space-y-2">
              <Label>Brokerage</Label>
              <Input
                defaultValue={agent.brokerage || ""}
                placeholder="Century 21"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email Signature</Label>
            <Textarea
              defaultValue={agent.email_signature || ""}
              placeholder="Best regards,&#10;Mike Johnson&#10;Century 21 Realty"
              rows={3}
            />
          </div>
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
            <div className="flex items-center gap-2">
              {agent.gmail_connected ? (
                <>
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Connected
                  </Badge>
                  <Button variant="outline" size="sm">
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm">Connect Gmail</Button>
              )}
            </div>
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
            <div className="flex items-center gap-2">
              {agent.calendar_connected ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Button size="sm" variant="outline">
                  Coming Soon
                </Button>
              )}
            </div>
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
            <Badge variant="default">Connected</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deep Analysis (Gemini)</span>
            <Badge variant="default">Connected</Badge>
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
