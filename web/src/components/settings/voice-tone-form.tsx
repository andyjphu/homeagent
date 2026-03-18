"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const TONES = [
  {
    value: "professional",
    label: "Professional",
    description: "Formal, precise, suited for corporate buyers",
  },
  {
    value: "casual",
    label: "Casual",
    description: "Friendly and relaxed, great for first-time buyers",
  },
  {
    value: "luxury",
    label: "Luxury",
    description: "Elevated language for high-end properties",
  },
  {
    value: "first_time_buyer",
    label: "First-time buyer friendly",
    description: "Simple explanations, no jargon",
  },
] as const;

interface VoiceToneFormProps {
  currentTone: string;
}

export function VoiceToneForm({ currentTone }: VoiceToneFormProps) {
  const [selected, setSelected] = useState(currentTone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("agents")
      .update({ voice_tone: selected })
      .eq("user_id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TONES.map(({ value, label, description }) => (
          <button
            key={value}
            onClick={() => setSelected(value)}
            className={`text-left rounded-lg border p-3 transition-colors ${
              selected === value
                ? "border-primary bg-primary/5"
                : "hover:border-muted-foreground/50"
            }`}
          >
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </button>
        ))}
      </div>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || selected === currentTone}
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save preference"}
      </Button>
    </div>
  );
}
