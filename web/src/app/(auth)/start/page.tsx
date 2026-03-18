"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Copy, Check, Mail, Users, Zap } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

export default function StartPage() {
  const [step, setStep] = useState<Step>(1);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 2
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  // Step 3
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerPreferences, setBuyerPreferences] = useState("");
  const [buyerSaving, setBuyerSaving] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const router = useRouter();
  const supabase = createClient() as any;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // Check if gmail is already connected
        supabase
          .from("agents")
          .select("gmail_connected")
          .eq("user_id", user.id)
          .single()
          .then(({ data: agent }: any) => {
            if (agent?.gmail_connected) setGmailConnected(true);
          });
        // If already authenticated, skip to step 2
        setStep(2);
      }
    });
  }, []);

  async function handleGoogleAuth() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/start`,
      },
    });
    if (error) setError(error.message);
  }

  async function handleGmailConnect() {
    setGmailConnecting(true);
    window.location.href = "/api/email/connect";
  }

  function skipGmail() {
    setStep(3);
  }

  async function handleAddBuyer(e: React.FormEvent) {
    e.preventDefault();
    setBuyerSaving(true);
    setError(null);

    try {
      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agent) throw new Error("Agent record not found");

      const intentProfile: any = {};
      if (buyerPreferences.trim()) {
        intentProfile.notes = buyerPreferences.trim();
      }

      const { data: buyer, error: buyerError } = await supabase
        .from("buyers")
        .insert({
          agent_id: agent.id,
          full_name: buyerName,
          email: buyerEmail || null,
          phone: buyerPhone || null,
          source: "manual",
          intent_profile: intentProfile,
        })
        .select("dashboard_token")
        .single();

      if (buyerError) throw buyerError;

      const link = `${window.location.origin}/p/${buyer.dashboard_token}`;
      setPortalLink(link);

      // Trigger email scan in background
      fetch("/api/email/scan", { method: "POST" }).catch(() => {});

      setStep(4);
    } catch (err: any) {
      setError(err.message || "Failed to create buyer");
    } finally {
      setBuyerSaving(false);
    }
  }

  async function copyPortalLink() {
    if (!portalLink) return;
    await navigator.clipboard.writeText(portalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">FoyerFind</h1>
          <p className="text-muted-foreground text-sm">
            Set up your account in 3 steps
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 justify-center">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  step > s
                    ? "bg-primary text-primary-foreground"
                    : step === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-px w-12 transition-colors ${
                    step > s ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Google Auth */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connect your Google account</CardTitle>
              <CardDescription>
                Sign in with Google to get started. We&apos;ll create your agent account automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleGoogleAuth}>
                Continue with Google
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                We&apos;ll ask for Gmail access in the next step so you can control what we can see.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Gmail */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Connect Gmail
              </CardTitle>
              <CardDescription>
                We&apos;ll watch your inbox for property addresses and buyer conversations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scope disclosure */}
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  What we access
                </p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Read emails to detect property addresses and buyer leads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Create drafts in your Gmail (you always review before sending)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>We never auto-send — everything goes to drafts first</span>
                  </li>
                </ul>
              </div>

              {gmailConnected ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Gmail connected
                </div>
              ) : null}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                {!gmailConnected && (
                  <Button
                    className="w-full"
                    onClick={handleGmailConnect}
                    disabled={gmailConnecting}
                  >
                    {gmailConnecting ? "Redirecting to Google..." : "Connect Gmail"}
                  </Button>
                )}
                <Button
                  variant={gmailConnected ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setStep(3)}
                >
                  {gmailConnected ? "Continue" : "Skip for now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Add first buyer */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Add your first buyer
              </CardTitle>
              <CardDescription>
                We&apos;ll create a private portal link they can use to view properties you curate for them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBuyer} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="buyer-name">Full name *</Label>
                  <Input
                    id="buyer-name"
                    placeholder="Sarah Chen"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buyer-email">Email</Label>
                  <Input
                    id="buyer-email"
                    type="email"
                    placeholder="sarah@email.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buyer-phone">Phone</Label>
                  <Input
                    id="buyer-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buyer-prefs">Preferences (optional)</Label>
                  <Input
                    id="buyer-prefs"
                    placeholder="3BR, under $800k, East Side, good schools"
                    value={buyerPreferences}
                    onChange={(e) => setBuyerPreferences(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={buyerSaving}>
                    {buyerSaving ? "Creating..." : "Add Buyer"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push("/app/connections")}
                  >
                    Skip — go to my dashboard
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                You&apos;re all set!
              </CardTitle>
              <CardDescription>
                FoyerFind is running in the background. Here&apos;s what happens next:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>We&apos;re scanning your inbox for property addresses and buyer conversations now</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Research briefs will appear in your Research tab as we find relevant listings</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Drafts will appear in your Gmail inbox — nothing sends without your review</span>
                </li>
              </ul>

              {portalLink && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Buyer portal link
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {portalLink}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyPortalLink}
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this private link with your buyer to give them access to their portal.
                  </p>
                </div>
              )}

              <Button className="w-full" onClick={() => router.push("/app/connections")}>
                Go to my dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
