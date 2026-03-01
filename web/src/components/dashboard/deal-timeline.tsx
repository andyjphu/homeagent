"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const DEAL_STAGES = [
  { key: "prospecting", label: "Prospecting" },
  { key: "touring", label: "Touring" },
  { key: "pre_offer", label: "Pre-Offer" },
  { key: "negotiating", label: "Negotiating" },
  { key: "under_contract", label: "Under Contract" },
  { key: "inspection", label: "Inspection" },
  { key: "appraisal", label: "Appraisal" },
  { key: "closing", label: "Closing" },
  { key: "closed", label: "Closed" },
];

export function DealTimeline({ deal }: { deal: any }) {
  const currentStageIndex = DEAL_STAGES.findIndex(
    (s) => s.key === deal.stage
  );
  const property = deal.properties;
  const contingencies = Array.isArray(deal.contingencies)
    ? deal.contingencies
    : [];

  return (
    <Card className="overflow-hidden border-primary/30">
      {/* Progress accent bar */}
      <div
        className="h-1 bg-primary transition-all"
        style={{
          width: `${((currentStageIndex + 1) / DEAL_STAGES.length) * 100}%`,
        }}
      />
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Active Deal</h3>
            {property && (
              <p className="text-sm text-muted-foreground">
                {property.address}
              </p>
            )}
          </div>
          <Badge className="text-sm">
            {DEAL_STAGES[currentStageIndex]?.label ?? deal.stage}
          </Badge>
        </div>

        {/* Timeline */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <div className="flex items-start justify-between min-w-[500px]">
            {DEAL_STAGES.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              return (
                <div
                  key={stage.key}
                  className="flex flex-col items-center relative flex-1"
                >
                  {/* Connector line */}
                  {index > 0 && (
                    <div
                      className={`absolute top-3 right-1/2 w-full h-0.5 ${
                        isCompleted || isCurrent
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  )}
                  {/* Stage dot */}
                  <div className="relative z-10 bg-background">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-primary fill-primary/20" />
                    ) : isCurrent ? (
                      <div className="h-6 w-6 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-1 text-center leading-tight max-w-[4rem] ${
                      isCurrent
                        ? "font-semibold text-primary"
                        : isCompleted
                          ? "text-foreground"
                          : "text-muted-foreground/60"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deal details */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {deal.current_offer_price != null && (
            <div>
              <span className="text-muted-foreground">Current Offer: </span>
              <span className="font-semibold">
                ${deal.current_offer_price.toLocaleString()}
              </span>
            </div>
          )}
          {deal.closing_date && (
            <div>
              <span className="text-muted-foreground">Target Close: </span>
              <span className="font-semibold">
                {new Date(deal.closing_date).toLocaleDateString()}
              </span>
            </div>
          )}
          {deal.earnest_money != null && (
            <div>
              <span className="text-muted-foreground">Earnest Money: </span>
              <span className="font-semibold">
                ${deal.earnest_money.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Contingencies / Deadlines */}
        {contingencies.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Upcoming Deadlines
            </p>
            {contingencies.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{c.name || c.type}</span>
                {c.deadline && (
                  <span className="text-muted-foreground">
                    &mdash; {new Date(c.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
