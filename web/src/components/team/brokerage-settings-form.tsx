"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

interface BrokerageSettingsFormProps {
  name: string;
  logoUrl: string;
  brandColors: Record<string, string>;
  customDomain: string;
}

export function BrokerageSettingsForm({
  name: initialName,
  logoUrl: initialLogoUrl,
  brandColors: initialColors,
  customDomain: initialDomain,
}: BrokerageSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [primaryColor, setPrimaryColor] = useState(
    initialColors.primaryColor || "#000000"
  );
  const [accentColor, setAccentColor] = useState(
    initialColors.accentColor || "#3b82f6"
  );
  const [customDomain, setCustomDomain] = useState(initialDomain);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/team/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          logo_url: logoUrl || null,
          brand_colors: { primaryColor, accentColor },
          custom_domain: customDomain || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to save");
        return;
      }
      setMessage("Settings saved");
      router.refresh();
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Brokerage Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="brokerage-name">Brokerage Name</Label>
            <Input
              id="brokerage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              type="url"
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  id="primary-color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accent-color">Accent Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  id="accent-color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="custom-domain">Custom Domain</Label>
            <Input
              id="custom-domain"
              placeholder="portal.yourbrokerage.com"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            {message && (
              <p className={`text-sm ${message === "Settings saved" ? "text-green-600" : "text-red-500"}`}>
                {message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
