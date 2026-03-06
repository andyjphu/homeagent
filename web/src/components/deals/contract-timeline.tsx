import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface ContractTimelineProps {
  contractDate: string | null;
  closingDate: string | null;
  contingencies: Record<string, string>;
}

interface TimelineItem {
  label: string;
  date: Date;
  key: string;
}

export function ContractTimeline({
  contractDate,
  closingDate,
  contingencies,
}: ContractTimelineProps) {
  const items: TimelineItem[] = [];

  if (contractDate) {
    items.push({ label: "Contract Signed", date: new Date(contractDate), key: "contract" });
  }
  if (contingencies?.inspection_deadline) {
    items.push({ label: "Inspection Deadline", date: new Date(contingencies.inspection_deadline), key: "inspection" });
  }
  if (contingencies?.appraisal_deadline) {
    items.push({ label: "Appraisal Deadline", date: new Date(contingencies.appraisal_deadline), key: "appraisal" });
  }
  if (contingencies?.financing_deadline) {
    items.push({ label: "Financing Deadline", date: new Date(contingencies.financing_deadline), key: "financing" });
  }
  if (contingencies?.title_deadline) {
    items.push({ label: "Title Deadline", date: new Date(contingencies.title_deadline), key: "title" });
  }
  if (closingDate) {
    items.push({ label: "Closing", date: new Date(closingDate), key: "closing" });
  }

  if (items.length === 0) return null;

  // Sort by date
  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  const now = new Date();

  function getStatus(item: TimelineItem) {
    const diff = item.date.getTime() - now.getTime();
    const daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { status: "past" as const, daysUntil };
    if (daysUntil <= 3) return { status: "urgent" as const, daysUntil };
    if (daysUntil <= 7) return { status: "soon" as const, daysUntil };
    return { status: "future" as const, daysUntil };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Contract Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {items.map((item) => {
              const { status, daysUntil } = getStatus(item);
              return (
                <div key={item.key} className="relative flex items-start gap-3 pl-8">
                  {/* Dot */}
                  <div className="absolute left-1.5 top-1">
                    {status === "past" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : status === "urgent" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      {status === "urgent" && (
                        <Badge variant="destructive" className="text-xs">
                          {daysUntil === 0
                            ? "Today"
                            : daysUntil < 0
                            ? `${Math.abs(daysUntil)}d overdue`
                            : `${daysUntil}d left`}
                        </Badge>
                      )}
                      {status === "soon" && (
                        <Badge variant="secondary" className="text-xs">
                          {daysUntil}d left
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
