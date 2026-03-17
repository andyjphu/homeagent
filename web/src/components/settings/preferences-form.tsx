"use client";

import { useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import type { AgentPreferences } from "@/types/database";
import { DEFAULT_PREFERENCES } from "@/types/database";

interface PreferencesFormProps {
  preferences: Partial<AgentPreferences>;
  section: "notifications" | "voice_ai" | "enrichment" | "ai";
}

const SECTION_FIELDS: Record<PreferencesFormProps["section"], { key: keyof AgentPreferences; label: string; description?: string; locked?: boolean }[]> = {
  notifications: [
    { key: "new_leads", label: "New leads", description: "Always notified when new leads are detected", locked: true },
    { key: "email_activity", label: "Email activity", description: "Notifications for inbound/outbound emails" },
    { key: "property_changes", label: "Property changes", description: "Buyer favorites, comments, dashboard views, price changes" },
    { key: "deadline_reminders", label: "Deadline reminders", description: "Contract deadlines, inspection dates, closing dates" },
    { key: "sms_notifications", label: "SMS notifications", description: "Receive high-priority alerts via text message (requires phone number)" },
  ],
  voice_ai: [
    { key: "auto_create_leads_from_calls", label: "Auto-create leads from AI calls", description: "Automatically create lead entries when the AI receptionist handles calls" },
  ],
  enrichment: [
    { key: "auto_enrich_properties", label: "Auto-enrich on property add", description: "Automatically fetch Walk Score, demographics, and other data when adding properties" },
  ],
  ai: [
    { key: "ai_property_scoring", label: "Property scoring", description: "AI-suggested match scores when properties are added to buyer shortlists" },
    { key: "ai_email_classification", label: "Email classification", description: "AI-suggested classification of inbound emails (deal-relevant, new lead, noise)" },
  ],
};

export function PreferencesForm({ preferences, section }: PreferencesFormProps) {
  const fields = SECTION_FIELDS[section];
  const merged = { ...DEFAULT_PREFERENCES, ...preferences };
  const [values, setValues] = useState<AgentPreferences>(merged);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleToggle = useCallback(async (key: keyof AgentPreferences, checked: boolean) => {
    const updated = { ...values, [key]: checked };
    setValues(updated);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } catch {
      // Revert on failure
      setValues(values);
    }
    setSaving(false);
  }, [values]);

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
            </Label>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
          <Switch
            id={field.key}
            checked={values[field.key]}
            onCheckedChange={(checked) => handleToggle(field.key, checked)}
            disabled={field.locked || saving}
          />
        </div>
      ))}
      {(saving || saved) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3 text-green-600" />
          )}
          {saving ? "Saving..." : "Saved"}
        </div>
      )}
    </div>
  );
}
