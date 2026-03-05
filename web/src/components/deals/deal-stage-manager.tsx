"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, AlertTriangle } from "lucide-react";
import type { DealStage } from "@/types/database";

const STAGES: { value: DealStage; label: string }[] = [
  { value: "prospecting", label: "Prospecting" },
  { value: "touring", label: "Touring" },
  { value: "pre_offer", label: "Pre-Offer" },
  { value: "negotiating", label: "Negotiating" },
  { value: "under_contract", label: "Under Contract" },
  { value: "inspection", label: "Inspection" },
  { value: "appraisal", label: "Appraisal" },
  { value: "closing", label: "Closing" },
  { value: "closed", label: "Closed" },
];

export function DealStageManager({
  dealId,
  currentStage,
}: {
  dealId: string;
  currentStage: DealStage;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const currentIndex = STAGES.findIndex((s) => s.value === currentStage);

  async function changeStage(newStage: DealStage) {
    if (newStage === currentStage) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update stage");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function advanceStage() {
    if (currentIndex >= STAGES.length - 1) return;
    const nextStage = STAGES[currentIndex + 1].value;
    await changeStage(nextStage);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STAGES.map((stage, i) => (
          <div key={stage.value} className="flex items-center">
            <Badge
              variant={
                i < currentIndex
                  ? "default"
                  : i === currentIndex
                  ? "destructive"
                  : "outline"
              }
              className="whitespace-nowrap"
            >
              {stage.label}
            </Badge>
            {i < STAGES.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-0.5 shrink-0" />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {currentIndex < STAGES.length - 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={advanceStage}
            disabled={loading}
          >
            {loading ? "..." : `Advance to ${STAGES[currentIndex + 1]?.label}`}
          </Button>
        )}
        <Select
          value={currentStage}
          onValueChange={(val) => changeStage(val as DealStage)}
          disabled={loading}
        >
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="Jump to stage..." />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
            <SelectItem value="dead">Mark as Dead</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
