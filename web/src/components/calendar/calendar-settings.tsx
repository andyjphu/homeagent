"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";

interface CalendarSettingsProps {
  workingHours: { start: string; end: string; days: number[] };
  autoCreateEvents: boolean;
  showAvailability: boolean;
}

const DAY_LABELS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

export function CalendarSettings({
  workingHours,
  autoCreateEvents,
  showAvailability,
}: CalendarSettingsProps) {
  const [hours, setHours] = useState(workingHours);
  const [autoCreate, setAutoCreate] = useState(autoCreateEvents);
  const [showAvail, setShowAvail] = useState(showAvailability);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(updates: Record<string, unknown>) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/calendar/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } catch {
      /* ignore */
    }
    setSaving(false);
  }

  function toggleDay(day: number) {
    const newDays = hours.days.includes(day)
      ? hours.days.filter((d) => d !== day)
      : [...hours.days, day].sort();
    const newHours = { ...hours, days: newDays };
    setHours(newHours);
    save({ workingHours: newHours });
  }

  return (
    <div className="space-y-4">
      {/* Working Hours */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Working Hours</Label>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={hours.start}
            onChange={(e) => {
              const h = { ...hours, start: e.target.value };
              setHours(h);
              save({ workingHours: h });
            }}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="time"
            value={hours.end}
            onChange={(e) => {
              const h = { ...hours, end: e.target.value };
              setHours(h);
              save({ workingHours: h });
            }}
            className="w-28"
          />
        </div>
      </div>

      {/* Working Days */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Working Days</Label>
        <div className="flex gap-1">
          {DAY_LABELS.map(({ value, label }) => (
            <Button
              key={value}
              variant={hours.days.includes(value) ? "default" : "outline"}
              size="sm"
              className="w-10 h-8 text-xs"
              onClick={() => toggleDay(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">
              Auto-create calendar events
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically add deal deadlines to your Google Calendar
            </p>
          </div>
          <Switch
            checked={autoCreate}
            onCheckedChange={(checked) => {
              setAutoCreate(checked);
              save({ autoCreateEvents: checked });
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">
              Show availability to buyers
            </Label>
            <p className="text-xs text-muted-foreground">
              Let buyers see your free/busy times for scheduling showings
            </p>
          </div>
          <Switch
            checked={showAvail}
            onCheckedChange={(checked) => {
              setShowAvail(checked);
              save({ showAvailability: checked });
            }}
          />
        </div>
      </div>

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
