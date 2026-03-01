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
import { ArrowLeft, Check, X, Loader2, ExternalLink, Phone } from "lucide-react";
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
        .select("*, communications:source_communication_id(type, gmail_message_id, gmail_thread_id, subject, from_address, recording_url, raw_content, duration_seconds, ai_analysis)")
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
          estimated_income: extractedInfo.estimated_income,
          beds_min: extractedInfo.beds,
          baths_min: extractedInfo.baths,
          sqft_min: extractedInfo.sqft_min,
          preferred_areas: extractedInfo.areas || [],
          must_have_amenities: extractedInfo.amenities || [],
          timeline: extractedInfo.timeline,
          household_size: extractedInfo.household_size,
          max_commute_minutes: extractedInfo.max_commute_minutes,
          school_priority: extractedInfo.school_priority,
          hoa_tolerance: extractedInfo.hoa_tolerance,
          priorities_ranked: extractedInfo.priorities || [],
          concerns: extractedInfo.concerns || [],
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
            <p className="text-sm">{lead.phone || extractedInfo.phone || "Not provided"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Call recording — audio player + transcript */}
      {lead.source === "call" && lead.communications?.recording_url && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Call Recording
              {lead.communications.duration_seconds && (
                <span className="text-xs font-normal text-muted-foreground">
                  {Math.floor(lead.communications.duration_seconds / 60)}m{" "}
                  {lead.communications.duration_seconds % 60}s
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <audio
              controls
              src={lead.communications.recording_url}
              className="w-full"
            />
            {lead.communications.raw_content && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Transcript
                </Label>
                <p className="text-sm whitespace-pre-wrap mt-1 bg-muted p-3 rounded-md">
                  {lead.communications.raw_content}
                </p>
              </div>
            )}
            {(lead.communications.ai_analysis as any)?.summary && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  AI Summary
                </Label>
                <p className="text-sm mt-1">
                  {(lead.communications.ai_analysis as any).summary}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Source content */}
      {lead.raw_source_content && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Source Content</CardTitle>
                {lead.communications?.gmail_message_id && (
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${lead.communications.gmail_message_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View in Gmail
                  </a>
                )}
              </div>
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
            {lead.communications?.subject && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Subject:</span> {lead.communications.subject}
                {lead.communications.from_address && (
                  <> &middot; <span className="font-medium">From:</span> {lead.communications.from_address}</>
                )}
              </p>
            )}
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
              {extractedInfo.estimated_income && (
                <div>
                  <Label className="text-xs text-muted-foreground">Est. Income</Label>
                  <p>${extractedInfo.estimated_income?.toLocaleString()}/yr</p>
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
              {extractedInfo.sqft_min && (
                <div>
                  <Label className="text-xs text-muted-foreground">Min Sqft</Label>
                  <p>{extractedInfo.sqft_min?.toLocaleString()}</p>
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
                  <Label className="text-xs text-muted-foreground">Household Size</Label>
                  <p>{extractedInfo.household_size}</p>
                </div>
              )}
              {extractedInfo.max_commute_minutes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Max Commute</Label>
                  <p>{extractedInfo.max_commute_minutes} min</p>
                </div>
              )}
              {extractedInfo.school_priority && (
                <div>
                  <Label className="text-xs text-muted-foreground">School Priority</Label>
                  <p className="capitalize">{extractedInfo.school_priority}</p>
                </div>
              )}
              {extractedInfo.hoa_tolerance && (
                <div>
                  <Label className="text-xs text-muted-foreground">HOA Tolerance</Label>
                  <p className="capitalize">{extractedInfo.hoa_tolerance}</p>
                </div>
              )}
              {extractedInfo.referral_source && (
                <div>
                  <Label className="text-xs text-muted-foreground">Referral Source</Label>
                  <p>{extractedInfo.referral_source}</p>
                </div>
              )}
              {extractedInfo.priorities?.length > 0 && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Priorities</Label>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {extractedInfo.priorities.map((p: string) => (
                      <Badge key={p} variant="secondary">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {extractedInfo.amenities?.length > 0 && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Desired Amenities</Label>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {extractedInfo.amenities.map((a: string) => (
                      <Badge key={a} variant="outline">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {extractedInfo.concerns?.length > 0 && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Concerns</Label>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {extractedInfo.concerns.map((c: string) => (
                      <Badge key={c} variant="destructive">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
