"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

interface CommissionSectionProps {
  dealId: string;
  agreedPrice: number | null;
}

interface Commission {
  id: string;
  commission_type: "percentage" | "flat_fee";
  commission_value: number;
  expected_amount: number | null;
  paid_amount: number | null;
  paid_at: string | null;
  notes: string | null;
}

export function CommissionSection({ dealId, agreedPrice }: CommissionSectionProps) {
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [commissionType, setCommissionType] = useState<"percentage" | "flat_fee">("percentage");
  const [commissionValue, setCommissionValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/deals/${dealId}/commission`)
      .then((r) => r.json())
      .then((data) => {
        if (data.commission) {
          setCommission(data.commission);
          setCommissionType(data.commission.commission_type);
          setCommissionValue(String(data.commission.commission_value));
          setNotes(data.commission.notes || "");
        }
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const method = commission ? "PATCH" : "POST";
    const res = await fetch(`/api/deals/${dealId}/commission`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commission_type: commissionType,
        commission_value: parseFloat(commissionValue),
        notes: notes || null,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.commission) setCommission(data.commission);
      setEditing(false);
      // Refetch to get updated expected_amount
      const updated = await fetch(`/api/deals/${dealId}/commission`).then((r) => r.json());
      if (updated.commission) setCommission(updated.commission);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Loading commission...
        </CardContent>
      </Card>
    );
  }

  if (!commission && !editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Commission
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            No commission recorded for this deal.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Add Commission
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {commission ? "Edit Commission" : "Add Commission"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label>Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={commissionType === "percentage" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCommissionType("percentage")}
                >
                  Percentage
                </Button>
                <Button
                  type="button"
                  variant={commissionType === "flat_fee" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCommissionType("flat_fee")}
                >
                  Flat Fee
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="comm-value">
                {commissionType === "percentage" ? "Percentage (%)" : "Amount ($)"}
              </Label>
              <Input
                id="comm-value"
                type="number"
                step="0.01"
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
                placeholder={commissionType === "percentage" ? "2.5" : "10000"}
                required
              />
            </div>
            {commissionType === "percentage" && agreedPrice && commissionValue && (
              <p className="text-sm text-muted-foreground">
                Expected: ${(agreedPrice * (parseFloat(commissionValue) / 100)).toLocaleString()}
              </p>
            )}
            <div>
              <Label htmlFor="comm-notes">Notes</Label>
              <Input
                id="comm-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Commission
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {commission!.commission_type === "percentage" ? "Percentage" : "Flat Fee"}
          </Badge>
          <span className="font-semibold">
            {commission!.commission_type === "percentage"
              ? `${commission!.commission_value}%`
              : `$${commission!.commission_value.toLocaleString()}`}
          </span>
        </div>
        {commission!.expected_amount != null && (
          <p>
            <strong>Expected:</strong> ${commission!.expected_amount.toLocaleString()}
          </p>
        )}
        {commission!.paid_amount != null && (
          <p>
            <strong>Paid:</strong> ${commission!.paid_amount.toLocaleString()}
            {commission!.paid_at && (
              <span className="text-muted-foreground">
                {" "}on {new Date(commission!.paid_at).toLocaleDateString()}
              </span>
            )}
          </p>
        )}
        {commission!.notes && (
          <p className="text-muted-foreground">{commission!.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
