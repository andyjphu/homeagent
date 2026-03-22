import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock, FileText } from "lucide-react";
import type { DealStage } from "@/types/database";

const BUYER_STAGES: { value: DealStage; label: string }[] = [
  { value: "touring", label: "Touring" },
  { value: "pre_offer", label: "Preparing Offer" },
  { value: "negotiating", label: "Negotiating" },
  { value: "under_contract", label: "Under Contract" },
  { value: "inspection", label: "Inspection" },
  { value: "appraisal", label: "Appraisal" },
  { value: "closing", label: "Closing" },
  { value: "closed", label: "Closed" },
];

const STAGE_NEXT_STEPS: Record<string, string> = {
  touring:
    "Your agent is scheduling showings. Explore properties on your portal.",
  pre_offer: "Your agent is preparing an offer strategy.",
  negotiating:
    "An offer has been submitted. Your agent will update you on the seller's response.",
  under_contract:
    "Congratulations! You're under contract. Next: schedule inspections.",
  inspection:
    "Inspection period is active. Review the inspection report with your agent.",
  appraisal:
    "The property is being appraised. Results expected soon.",
  closing:
    "Almost there! Final walkthrough and closing documents are being prepared.",
  closed: "Congratulations! The deal is complete.",
};

const STAGE_DOCUMENTS: Record<string, string[]> = {
  pre_offer: ["Pre-approval letter", "Proof of funds"],
  negotiating: ["Signed offer documents"],
  under_contract: ["Earnest money deposit", "Homeowner's insurance quote"],
  inspection: ["Review inspection report"],
  appraisal: ["No documents needed from you at this stage"],
  closing: [
    "Valid government-issued ID",
    "Proof of homeowner's insurance",
    "Certified/cashier's check for closing costs",
    "Final walkthrough confirmation",
  ],
};

function stageIndex(stage: string): number {
  return BUYER_STAGES.findIndex((s) => s.value === stage);
}

export default async function BuyerDealStatusPage({
  params,
}: {
  params: Promise<{ portalToken: string; dealId: string }>;
}) {
  const { portalToken, dealId } = await params;
  const supabase = createAdminClient() as any;

  // Validate token and get buyer
  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, full_name, dashboard_token, agent_id")
    .eq("dashboard_token", portalToken)
    .single();

  if (!buyer) notFound();

  // Fetch deal (must belong to this buyer)
  const { data: deal } = await supabase
    .from("deals")
    .select("id, stage, stage_entered_at, closing_date, contingencies, contract_date, created_at, properties(address)")
    .eq("id", dealId)
    .eq("buyer_id", buyer.id)
    .single();

  if (!deal) notFound();

  const property = deal.properties as any;
  const currentStageIdx = stageIndex(deal.stage);
  const contingencies = (deal.contingencies ?? {}) as Record<string, string>;
  const nextSteps = STAGE_NEXT_STEPS[deal.stage] ?? "Your agent will provide an update soon.";
  const documents = STAGE_DOCUMENTS[deal.stage] ?? [];

  // Calculate days until closing
  const daysUntilClosing = deal.closing_date
    ? Math.ceil(
        (new Date(deal.closing_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Find next deadline
  const deadlineEntries = Object.entries(contingencies)
    .map(([key, value]) => ({
      type: key.replace(/_/g, " ").replace("deadline", "").trim(),
      date: new Date(value),
    }))
    .filter((d) => d.date.getTime() > Date.now())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextDeadline = deadlineEntries[0] ?? null;

  // Fetch agent name for display
  const { data: agent } = await supabase
    .from("agents")
    .select("full_name")
    .eq("id", buyer.agent_id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm text-muted-foreground">
            {agent?.full_name ? `Your agent: ${agent.full_name}` : ""}
          </p>
          <h1 className="text-xl font-semibold mt-1">
            {property?.address ?? "Your Deal"}
          </h1>
        </div>

        {/* Stage Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deal Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {BUYER_STAGES.map((stage, i) => {
                const isDone = i < currentStageIdx;
                const isCurrent = i === currentStageIdx;
                const isFuture = i > currentStageIdx;

                return (
                  <div
                    key={stage.value}
                    className={`flex items-center gap-3 ${
                      isFuture ? "opacity-40" : ""
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : isCurrent ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary/20 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        isCurrent ? "font-semibold" : ""
                      }`}
                    >
                      {stage.label}
                    </span>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Key Dates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Key Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {deal.closing_date && (
              <div className="flex justify-between">
                <span>Closing date</span>
                <span className="font-medium">
                  {new Date(deal.closing_date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {daysUntilClosing != null && daysUntilClosing > 0 && (
                    <span className="text-muted-foreground ml-1">
                      ({daysUntilClosing} days)
                    </span>
                  )}
                </span>
              </div>
            )}
            {nextDeadline && (
              <div className="flex justify-between">
                <span>Next deadline ({nextDeadline.type})</span>
                <span className="font-medium">
                  {nextDeadline.date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {!deal.closing_date && !nextDeadline && (
              <p className="text-muted-foreground">
                No key dates set yet. Your agent will update these soon.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">What&apos;s Next</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{nextSteps}</p>
          </CardContent>
        </Card>

        {/* Document Needs */}
        {documents.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents Needed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {documents.map((doc) => (
                  <li
                    key={doc}
                    className="text-sm flex items-start gap-2"
                  >
                    <span className="text-muted-foreground mt-0.5">•</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground pt-4">
          Powered by FoyerFind
        </p>
      </div>
    </div>
  );
}
