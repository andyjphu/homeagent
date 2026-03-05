"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";

interface ProfileFormProps {
  agent: {
    full_name: string;
    email: string;
    phone: string | null;
    brokerage: string | null;
    email_signature: string | null;
    communication_tone: string;
  };
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
] as const;

export function ProfileForm({ agent }: ProfileFormProps) {
  const [fullName, setFullName] = useState(agent.full_name);
  const [phone, setPhone] = useState(agent.phone || "");
  const [brokerage, setBrokerage] = useState(agent.brokerage || "");
  const [emailSignature, setEmailSignature] = useState(agent.email_signature || "");
  const [communicationTone, setCommunicationTone] = useState(agent.communication_tone || "professional");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          brokerage,
          email_signature: emailSignature,
          communication_tone: communicationTone,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save profile");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input defaultValue={agent.email} disabled />
          <p className="text-xs text-muted-foreground">Managed by Google sign-in</p>
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
      <div className="space-y-2">
        <Label>Communication Tone</Label>
        <Select value={communicationTone} onValueChange={setCommunicationTone}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Sets the tone for AI-drafted emails and communications
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
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
