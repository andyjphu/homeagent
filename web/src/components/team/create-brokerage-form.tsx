"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function CreateBrokerageForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Not part of a brokerage yet. Create one to manage a team, track
          compliance, and share branding.
        </p>
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          Create Brokerage
        </Button>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/team/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create brokerage");
        return;
      }
      router.push("/team");
      router.refresh();
    } catch {
      setError("Failed to create brokerage");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-3">
      <div>
        <Label htmlFor="brokerage-name">Brokerage Name</Label>
        <Input
          id="brokerage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Real Estate"
          required
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Creating..." : "Create"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
