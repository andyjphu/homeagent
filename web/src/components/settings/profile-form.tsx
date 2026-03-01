"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from "lucide-react";

export function ProfileForm({
  agent,
}: {
  agent: { full_name: string; email: string; phone: string | null; brokerage: string | null; email_signature: string | null };
}) {
  const [phone, setPhone] = useState(agent.phone || "");
  const [brokerage, setBrokerage] = useState(agent.brokerage || "");
  const [emailSignature, setEmailSignature] = useState(agent.email_signature || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, brokerage, email_signature: emailSignature }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silent
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
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
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(214) 555-0123"
          />
        </div>
        <div className="space-y-2">
          <Label>Brokerage</Label>
          <Input
            value={brokerage}
            onChange={(e) => setBrokerage(e.target.value)}
            placeholder="Century 21"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email Signature</Label>
        <Textarea
          value={emailSignature}
          onChange={(e) => setEmailSignature(e.target.value)}
          placeholder={"Best regards,\nMike Johnson\nCentury 21 Realty"}
          rows={3}
        />
      </div>
      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : saved ? (
          <Check className="h-3 w-3 mr-1" />
        ) : null}
        {saved ? "Saved" : "Save Profile"}
      </Button>
    </div>
  );
}
