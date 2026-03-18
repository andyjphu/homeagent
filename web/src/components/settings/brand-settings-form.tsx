"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BrandSettings {
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
}

interface BrandSettingsFormProps {
  brandSettings: BrandSettings;
}

export function BrandSettingsForm({ brandSettings }: BrandSettingsFormProps) {
  const [primaryColor, setPrimaryColor] = useState(brandSettings.primary_color ?? "#0f172a");
  const [accentColor, setAccentColor] = useState(brandSettings.accent_color ?? "#3b82f6");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("agents")
      .update({
        brand_settings: {
          ...brandSettings,
          primary_color: primaryColor,
          accent_color: accentColor,
        },
      })
      .eq("user_id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primary-color">Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              id="primary-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-8 w-8 rounded border cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-8 font-mono text-xs"
              placeholder="#0f172a"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="accent-color">Accent color</Label>
          <div className="flex items-center gap-2">
            <input
              id="accent-color"
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-8 w-8 rounded border cursor-pointer"
            />
            <Input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-8 font-mono text-xs"
              placeholder="#3b82f6"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Logo upload</Label>
        <p className="text-xs text-muted-foreground">
          Logo upload via Supabase Storage — coming soon.
        </p>
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved!" : "Save brand settings"}
      </Button>
    </div>
  );
}
