"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, Copy, Check, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";

function TemperatureBadge({ temp }: { temp: string }) {
  const variants: Record<string, "destructive" | "secondary" | "outline"> = {
    hot: "destructive",
    warm: "secondary",
    cool: "outline",
    cold: "outline",
  };
  return <Badge variant={variants[temp] ?? "outline"}>{temp}</Badge>;
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${token}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        copy();
      }}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy portal link"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function ClientsPage() {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New buyer form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState("");

  const supabase = createClient() as any;

  async function loadBuyers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) return;

    const { data } = await supabase
      .from("buyers")
      .select("id, full_name, email, temperature, last_activity_at, dashboard_visit_count, dashboard_token, is_active, intent_profile")
      .eq("agent_id", agent.id)
      .eq("is_active", true)
      .order("last_activity_at", { ascending: false, nullsFirst: false });

    setBuyers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadBuyers();
  }, []);

  async function handleAddBuyer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const intentProfile: any = {};
    if (prefs.trim()) intentProfile.notes = prefs.trim();

    const { error: buyerError } = await supabase.from("buyers").insert({
      agent_id: agent.id,
      full_name: name,
      email: email || null,
      phone: phone || null,
      source: "manual",
      intent_profile: intentProfile,
    });

    if (buyerError) {
      setError(buyerError.message);
      setSaving(false);
      return;
    }

    setName(""); setEmail(""); setPhone(""); setPrefs("");
    setDialogOpen(false);
    setSaving(false);
    loadBuyers();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading..." : `${buyers.length} active buyer${buyers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a buyer client</DialogTitle>
              <DialogDescription>
                We&apos;ll generate a private portal link for them automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddBuyer} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name *</Label>
                <Input
                  id="name"
                  placeholder="Sarah Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="sarah@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefs">Preferences</Label>
                <Input
                  id="prefs"
                  placeholder="3BR, under $800k, East Side"
                  value={prefs}
                  onChange={(e) => setPrefs(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Adding..." : "Add buyer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!loading && buyers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No active buyers yet.</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setDialogOpen(true)}
            >
              Add your first client
            </Button>
          </CardContent>
        </Card>
      )}

      {buyers.length > 0 && (
        <div className="divide-y border rounded-lg overflow-hidden">
          {buyers.map((buyer) => {
            const intent = (buyer.intent_profile || {}) as any;
            const lastActive = buyer.last_activity_at
              ? new Date(buyer.last_activity_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : null;

            return (
              <div
                key={buyer.id}
                className="flex items-center justify-between px-4 py-3 bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/buyers/${buyer.id}`}
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {buyer.full_name}
                    </Link>
                    <TemperatureBadge temp={buyer.temperature} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {buyer.email && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {buyer.email}
                      </span>
                    )}
                    {intent.notes && (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {intent.notes}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {lastActive && (
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {lastActive}
                    </span>
                  )}
                  {buyer.dashboard_visit_count > 0 && (
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {buyer.dashboard_visit_count} views
                    </span>
                  )}
                  <Link
                    href={`/p/${buyer.dashboard_token}`}
                    target="_blank"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Open buyer portal"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <CopyLink token={buyer.dashboard_token} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
