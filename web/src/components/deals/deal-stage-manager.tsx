"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
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
  const router = useRouter();

  const currentIndex = STAGES.findIndex((s) => s.value === currentStage);

  async function advanceStage() {
    if (currentIndex >= STAGES.length - 1) return;
    setLoading(true);

    const supabase = createClient() as any;
    const nextStage = STAGES[currentIndex + 1].value;
    await supabase
      .from("deals")
      .update({ stage: nextStage })
      .eq("id", dealId);

    router.refresh();
    setLoading(false);
  }

  return (
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
      {currentIndex < STAGES.length - 1 && (
        <Button
          size="sm"
          variant="outline"
          onClick={advanceStage}
          disabled={loading}
          className="ml-2 shrink-0"
        >
          {loading ? "..." : "Advance"}
        </Button>
      )}
    </div>
  );
}
