"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarDays } from "lucide-react";

interface ContractDatesFormProps {
  dealId: string;
  contractDate: string | null;
  closingDate: string | null;
  earnestMoney: number | null;
  agreedPrice: number | null;
  contingencies: Record<string, string>;
}

export function ContractDatesForm({
  dealId,
  contractDate,
  closingDate,
  earnestMoney,
  agreedPrice,
  contingencies,
}: ContractDatesFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    contractDate: contractDate ?? "",
    closingDate: closingDate ?? "",
    earnestMoney: earnestMoney?.toString() ?? "",
    agreedPrice: agreedPrice?.toString() ?? "",
    inspectionDeadline: contingencies?.inspection_deadline ?? "",
    appraisalDeadline: contingencies?.appraisal_deadline ?? "",
    financingDeadline: contingencies?.financing_deadline ?? "",
    titleDeadline: contingencies?.title_deadline ?? "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_date: form.contractDate || null,
          closing_date: form.closingDate || null,
          earnest_money: form.earnestMoney ? parseInt(form.earnestMoney, 10) : null,
          agreed_price: form.agreedPrice ? parseInt(form.agreedPrice, 10) : null,
          contingencies: {
            ...contingencies,
            inspection_deadline: form.inspectionDeadline || undefined,
            appraisal_deadline: form.appraisalDeadline || undefined,
            financing_deadline: form.financingDeadline || undefined,
            title_deadline: form.titleDeadline || undefined,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save dates");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Contract Details & Key Dates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agreedPrice">Agreed Price ($)</Label>
            <Input
              id="agreedPrice"
              type="text"
              inputMode="numeric"
              placeholder="450000"
              value={form.agreedPrice}
              onChange={(e) => updateField("agreedPrice", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="earnestMoney">Earnest Money ($)</Label>
            <Input
              id="earnestMoney"
              type="text"
              inputMode="numeric"
              placeholder="10000"
              value={form.earnestMoney}
              onChange={(e) => updateField("earnestMoney", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractDate">Contract Date</Label>
            <Input
              id="contractDate"
              type="date"
              value={form.contractDate}
              onChange={(e) => updateField("contractDate", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closingDate">Target Closing Date</Label>
            <Input
              id="closingDate"
              type="date"
              value={form.closingDate}
              onChange={(e) => updateField("closingDate", e.target.value)}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Contingency Deadlines</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inspectionDeadline">Inspection Deadline</Label>
              <Input
                id="inspectionDeadline"
                type="date"
                value={form.inspectionDeadline}
                onChange={(e) => updateField("inspectionDeadline", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appraisalDeadline">Appraisal Deadline</Label>
              <Input
                id="appraisalDeadline"
                type="date"
                value={form.appraisalDeadline}
                onChange={(e) => updateField("appraisalDeadline", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="financingDeadline">Financing Deadline</Label>
              <Input
                id="financingDeadline"
                type="date"
                value={form.financingDeadline}
                onChange={(e) => updateField("financingDeadline", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titleDeadline">Title Deadline</Label>
              <Input
                id="titleDeadline"
                type="date"
                value={form.titleDeadline}
                onChange={(e) => updateField("titleDeadline", e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-green-600">Saved successfully</p>}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Dates
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
