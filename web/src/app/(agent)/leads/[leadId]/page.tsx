"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    async function fetchLead() {
      const supabase = createClient() as any;
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("id", params.leadId as string)
        .single();
      setLead(data);
      setLoading(false);
    }
    fetchLead();
  }, [params.leadId]);

  async function handleConfirm() {
    if (!lead) return;
    setConfirming(true);

    const supabase = createClient() as any;
    const { data: agentData } = await supabase
      .from("agents")
      .select("id")
      .single();

    if (!agentData) return;

    // Create buyer record
    const extractedInfo = (lead.extracted_info || {}) as any;
    const { data: buyer, error: buyerError } = await supabase
      .from("buyers")
      .insert({
        agent_id: agentData.id,
        full_name: lead.name || "Unknown",
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        referral_source: extractedInfo.referral_source || null,
        original_lead_id: lead.id,
        intent_profile: {
          budget_min: extractedInfo.budget_min,
          budget_max: extractedInfo.budget_max,
          beds_min: extractedInfo.beds,
          baths_min: extractedInfo.baths,
          preferred_areas: extractedInfo.areas || [],
          must_have_amenities: extractedInfo.amenities || [],
          timeline: extractedInfo.timeline,
          household_size: extractedInfo.household_size,
          priorities_ranked: extractedInfo.priorities || [],
          concerns: [],
        },
      })
      .select()
      .single();

    if (buyerError || !buyer) {
      setConfirming(false);
      return;
    }

    // Update lead status
    await supabase
      .from("leads")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        merged_into_buyer_id: buyer.id,
      })
      .eq("id", lead.id);

    router.push(`/buyers/${buyer.id}`);
  }

  async function handleDismiss() {
    if (!lead) return;
    setDismissing(true);
    const supabase = createClient() as any;
    await supabase
      .from("leads")
      .update({ status: "dismissed" })
      .eq("id", lead.id);
    router.push("/leads");
    router.refresh();
  }

  async function handleExtractInfo() {
    if (!lead?.raw_source_content) return;
    setExtracting(true);

    try {
      const response = await fetch("/api/leads/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          content: lead.raw_source_content,
        }),
      });
      const data = await response.json();

      if (data.extracted_info) {
        setLead({
          ...lead,
          extracted_info: data.extracted_info,
          name: data.name || lead.name,
        });
      }
    } catch (err) {
      console.error("Failed to extract info:", err);
    }
    setExtracting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return <p className="text-muted-foreground">Lead not found</p>;
  }

  const extractedInfo = (lead.extracted_info || {}) as any;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {lead.name || "Unknown Contact"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{lead.source}</Badge>
            <Badge
              variant={
                lead.confidence === "high"
                  ? "default"
                  : lead.confidence === "medium"
                  ? "secondary"
                  : "outline"
              }
            >
              {lead.confidence} confidence
            </Badge>
            <Badge
              variant={lead.status === "draft" ? "destructive" : "secondary"}
            >
              {lead.status}
            </Badge>
          </div>
        </div>
        {lead.status === "draft" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDismiss} disabled={dismissing}>
              <X className="h-4 w-4 mr-1" />
              {dismissing ? "..." : "Dismiss"}
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              <Check className="h-4 w-4 mr-1" />
              {confirming ? "Creating buyer..." : "Confirm & Create Buyer"}
            </Button>
          </div>
        )}
      </div>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm">{lead.email || "Not provided"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <p className="text-sm">{lead.phone || "Not provided"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Source content */}
      {lead.raw_source_content && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Source Content</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExtractInfo}
                disabled={extracting}
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  "AI Extract Info"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {lead.raw_source_content}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Extracted info */}
      {Object.keys(extractedInfo).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extracted Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {extractedInfo.budget_min && (
                <div>
                  <Label className="text-xs text-muted-foreground">Budget</Label>
                  <p>
                    ${extractedInfo.budget_min?.toLocaleString()} -{" "}
                    ${extractedInfo.budget_max?.toLocaleString()}
                  </p>
                </div>
              )}
              {extractedInfo.beds && (
                <div>
                  <Label className="text-xs text-muted-foreground">Beds</Label>
                  <p>{extractedInfo.beds}+</p>
                </div>
              )}
              {extractedInfo.baths && (
                <div>
                  <Label className="text-xs text-muted-foreground">Baths</Label>
                  <p>{extractedInfo.baths}+</p>
                </div>
              )}
              {extractedInfo.areas?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Areas</Label>
                  <p>{extractedInfo.areas.join(", ")}</p>
                </div>
              )}
              {extractedInfo.timeline && (
                <div>
                  <Label className="text-xs text-muted-foreground">Timeline</Label>
                  <p>{extractedInfo.timeline}</p>
                </div>
              )}
              {extractedInfo.household_size && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Household Size
                  </Label>
                  <p>{extractedInfo.household_size}</p>
                </div>
              )}
              {extractedInfo.priorities?.length > 0 && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Priorities</Label>
                  <p>{extractedInfo.priorities.join(", ")}</p>
                </div>
              )}
              {extractedInfo.referral_source && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Referral Source
                  </Label>
                  <p>{extractedInfo.referral_source}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
