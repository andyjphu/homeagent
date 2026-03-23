"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy, Check } from "lucide-react";

export function InviteAgentForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteUrl(null);

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create invite");
        return;
      }
      setInviteUrl(window.location.origin + data.invite_url);
      setEmail("");
    } catch {
      setError("Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Invite Agent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInvite} className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="invite-email" className="text-sm">
              Email Address
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="agent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Inviting..." : "Send Invite"}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}

        {inviteUrl && (
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Invite link created:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 truncate">{inviteUrl}</code>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Share this link with the agent. It expires in 7 days.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
