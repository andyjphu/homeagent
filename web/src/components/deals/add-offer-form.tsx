"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Plus, X } from "lucide-react";
import type { OfferType } from "@/types/database";

export function AddOfferForm({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [offerType, setOfferType] = useState<OfferType>("initial");
  const [price, setPrice] = useState("");
  const [closingDays, setClosingDays] = useState("");
  const [otherTerms, setOtherTerms] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");

  function reset() {
    setOfferType("initial");
    setPrice("");
    setClosingDays("");
    setOtherTerms("");
    setResponseDeadline("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseInt(price.replace(/[^0-9]/g, ""), 10);
    if (!priceNum || priceNum <= 0) {
      setError("Enter a valid price");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerType,
          price: priceNum,
          closingDays: closingDays ? parseInt(closingDays, 10) : undefined,
          otherTerms: otherTerms || undefined,
          responseDeadline: responseDeadline || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create offer");
        return;
      }

      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Add Offer
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">New Offer</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offerType">Offer Type</Label>
              <Select
                value={offerType}
                onValueChange={(v) => setOfferType(v as OfferType)}
              >
                <SelectTrigger id="offerType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial">Initial</SelectItem>
                  <SelectItem value="counter">Counter</SelectItem>
                  <SelectItem value="best_and_final">Best & Final</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="text"
                inputMode="numeric"
                placeholder="450000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="closingDays">Closing Days</Label>
              <Input
                id="closingDays"
                type="number"
                placeholder="30"
                value={closingDays}
                onChange={(e) => setClosingDays(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responseDeadline">Response Deadline</Label>
              <Input
                id="responseDeadline"
                type="date"
                value={responseDeadline}
                onChange={(e) => setResponseDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherTerms">Other Terms / Contingencies</Label>
            <Textarea
              id="otherTerms"
              placeholder="Financing contingency, inspection contingency, appraisal contingency..."
              value={otherTerms}
              onChange={(e) => setOtherTerms(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit Offer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
