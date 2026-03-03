"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Mail,
  Phone,
  User,
  Check,
  X,
  Loader2,
  Globe,
} from "lucide-react";
import Link from "next/link";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const sourceIcons: Record<string, typeof Mail> = {
  email: Mail,
  call: Phone,
  manual: User,
  referral: Globe,
};

const confidenceColors: Record<string, string> = {
  high: "bg-green-500/15 text-green-700 border-green-200",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-200",
  low: "bg-gray-500/10 text-gray-500 border-gray-200",
};

interface NewLeadsSectionProps {
  leads: Lead[];
  totalCount: number;
}

export function NewLeadsSection({ leads, totalCount }: NewLeadsSectionProps) {
  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-sm mb-1">No new leads</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            New leads from email, calls, and manual entry will appear here.{" "}
            <Link
              href="/settings"
              className="text-primary hover:underline"
            >
              Connect Gmail
            </Link>{" "}
            to detect leads automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            New Leads
            <Badge variant="destructive" className="text-xs">
              {totalCount}
            </Badge>
          </CardTitle>
          <Link href="/leads">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <CardDescription>
          Review and confirm new leads to start working with them
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
          {totalCount > leads.length && (
            <Link href="/leads" className="block">
              <p className="text-sm text-primary text-center py-2 hover:underline">
                +{totalCount - leads.length} more leads
              </p>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const SourceIcon = sourceIcons[lead.source] || User;
  const extractedInfo = (lead.extracted_info || {}) as any;

  // Build summary from extracted info
  const summaryParts: string[] = [];
  if (extractedInfo.budget_max) {
    summaryParts.push(
      `$${(extractedInfo.budget_min ?? 0).toLocaleString()}-$${extractedInfo.budget_max.toLocaleString()}`
    );
  }
  if (extractedInfo.beds) summaryParts.push(`${extractedInfo.beds}+ beds`);
  if (extractedInfo.areas?.length > 0)
    summaryParts.push(extractedInfo.areas.join(", "));
  if (extractedInfo.timeline) summaryParts.push(extractedInfo.timeline);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/confirm`, {
        method: "POST",
      });
      if (res.ok) {
        const { buyer } = await res.json();
        router.push(`/buyers/${buyer.id}`);
      }
    } catch {
      setConfirming(false);
    }
  }

  async function handleDismiss() {
    setDismissing(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/dismiss`, {
        method: "POST",
      });
      if (res.ok) {
        setDismissed(true);
        router.refresh();
      }
    } catch {
      setDismissing(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="flex items-start gap-3 min-w-0">
        {/* Confidence indicator dot */}
        <div className="mt-1.5 shrink-0">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              lead.confidence === "high"
                ? "bg-green-500"
                : lead.confidence === "medium"
                ? "bg-yellow-500"
                : "bg-gray-400"
            }`}
            title={`${lead.confidence} confidence`}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">
              {lead.name || "Unknown Contact"}
            </p>
            <Badge
              variant="outline"
              className="flex items-center gap-1 text-xs"
            >
              <SourceIcon className="h-3 w-3" />
              {lead.source}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs border ${confidenceColors[lead.confidence] || ""}`}
            >
              {lead.confidence}
            </Badge>
          </div>
          {summaryParts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {summaryParts.join(" · ")}
            </p>
          )}
          {lead.raw_source_content && summaryParts.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {lead.raw_source_content}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={handleDismiss}
          disabled={dismissing || confirming}
          title="Dismiss lead"
        >
          {dismissing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          className="h-8"
          onClick={handleConfirm}
          disabled={confirming || dismissing}
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              Confirm
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
