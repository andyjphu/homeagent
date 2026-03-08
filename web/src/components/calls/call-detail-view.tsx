"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Clock,
  User,
  MapPin,
  DollarSign,
  Home,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Bot,
} from "lucide-react";

interface CallAnalysis {
  status?: string;
  source?: string;
  summary?: string;
  caller_name?: string;
  notes?: string;
  extraction?: {
    caller_name: string | null;
    phone: string | null;
    email: string | null;
    budget_min: number | null;
    budget_max: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    locations: string[];
    property_type: string | null;
    timeline: string | null;
    must_haves: string[];
    deal_breakers: string[];
    urgency: string;
    sentiment: string;
    is_real_estate_related: boolean;
    summary: string;
    action_items: string[];
  };
  // Voice agent fields
  platform?: string;
  sentiment?: string;
  call_successful?: boolean;
  is_voicemail?: boolean;
  structured_data?: Record<string, unknown>;
  // Legacy Twilio fields
  buyer_temperature?: string;
  action_items?: Array<{ action: string; deadline?: string }>;
}

interface CallRecord {
  id: string;
  direction: string;
  from_address: string | null;
  subject: string | null;
  raw_content: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  ai_analysis: CallAnalysis;
  is_processed: boolean;
  lead_id: string | null;
  buyer_id: string | null;
  occurred_at: string;
  buyers?: { full_name: string } | null;
}

export function CallDetailView({
  call,
  onClose,
}: {
  call: CallRecord;
  onClose: () => void;
}) {
  const analysis = call.ai_analysis || {};
  const extraction = analysis.extraction;
  const router = useRouter();
  const [showTranscript, setShowTranscript] = useState(false);

  const callerName =
    extraction?.caller_name ||
    analysis.caller_name ||
    call.buyers?.full_name ||
    call.from_address ||
    "Unknown";

  const summary = extraction?.summary || analysis.summary;
  const isVoiceAgent = analysis.source === "ai_voice_agent";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {isVoiceAgent ? (
              <Bot className="h-5 w-5 text-violet-500" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
            {call.subject || `Call with ${callerName}`}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{call.direction}</Badge>
            {isVoiceAgent ? (
              <Badge className="bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100">
                <Bot className="h-3 w-3 mr-1" />
                AI Receptionist
              </Badge>
            ) : (
              <Badge variant="outline">
                {analysis.source === "upload"
                  ? "Uploaded"
                  : analysis.source === "manual"
                    ? "Manual log"
                    : analysis.source || "Call"}
              </Badge>
            )}
            {analysis.status && (
              <Badge
                variant={
                  analysis.status === "processed"
                    ? "secondary"
                    : analysis.status === "failed"
                      ? "destructive"
                      : "outline"
                }
              >
                {analysis.status === "processed" ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : analysis.status === "failed" ? (
                  <AlertCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {analysis.status}
              </Badge>
            )}
            {extraction?.urgency && (
              <Badge
                variant={
                  extraction.urgency === "high"
                    ? "destructive"
                    : extraction.urgency === "medium"
                      ? "secondary"
                      : "outline"
                }
              >
                {extraction.urgency} urgency
              </Badge>
            )}
            {analysis.buyer_temperature && (
              <Badge
                variant={
                  analysis.buyer_temperature === "hot"
                    ? "destructive"
                    : analysis.buyer_temperature === "warm"
                      ? "secondary"
                      : "outline"
                }
              >
                {analysis.buyer_temperature}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{new Date(call.occurred_at).toLocaleString()}</p>
          {call.duration_seconds != null && call.duration_seconds > 0 && (
            <p className="flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3" />
              {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
            </p>
          )}
        </div>
      </div>

      {/* Audio Player */}
      {call.recording_url && (
        <Card>
          <CardContent className="p-3">
            <audio controls className="w-full" preload="metadata">
              <source src={call.recording_url} />
              Your browser does not support audio playback.
            </audio>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summary && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* AI Qualification Summary (voice agent calls) */}
      {isVoiceAgent && (analysis.sentiment || analysis.call_successful != null || analysis.platform) && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-500" />
              AI Qualification Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {analysis.platform && (
                <div>
                  <p className="text-xs text-muted-foreground">Platform</p>
                  <p className="font-medium capitalize">{analysis.platform}</p>
                </div>
              )}
              {analysis.sentiment && (
                <div>
                  <p className="text-xs text-muted-foreground">Caller Sentiment</p>
                  <Badge
                    variant={
                      analysis.sentiment.toLowerCase().includes("positive")
                        ? "secondary"
                        : analysis.sentiment.toLowerCase().includes("negative")
                          ? "destructive"
                          : "outline"
                    }
                    className="text-xs mt-0.5"
                  >
                    {analysis.sentiment}
                  </Badge>
                </div>
              )}
              {analysis.call_successful != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Call Successful</p>
                  <p className="font-medium">{analysis.call_successful ? "Yes" : "No"}</p>
                </div>
              )}
              {analysis.is_voicemail && (
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="outline" className="text-xs mt-0.5">Voicemail</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Info */}
      {extraction && extraction.is_real_estate_related !== false && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">Extracted Information</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(extraction.caller_name || call.from_address) && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="font-medium">{extraction.caller_name || callerName}</p>
                    {extraction.phone && extraction.phone !== "null" && (
                      <p className="text-xs text-muted-foreground">{extraction.phone}</p>
                    )}
                    {extraction.email && extraction.email !== "null" && (
                      <p className="text-xs text-muted-foreground">{extraction.email}</p>
                    )}
                  </div>
                </div>
              )}
              {(extraction.budget_min || extraction.budget_max) && (
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="font-medium">
                      {extraction.budget_min && extraction.budget_max
                        ? `$${formatK(extraction.budget_min)} - $${formatK(extraction.budget_max)}`
                        : extraction.budget_max
                          ? `Up to $${formatK(extraction.budget_max)}`
                          : `From $${formatK(extraction.budget_min!)}`}
                    </p>
                  </div>
                </div>
              )}
              {(extraction.bedrooms || extraction.bathrooms || extraction.property_type) && (
                <div className="flex items-start gap-2">
                  <Home className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    <p className="font-medium">
                      {[
                        extraction.bedrooms ? `${extraction.bedrooms} bed` : null,
                        extraction.bathrooms ? `${extraction.bathrooms} bath` : null,
                        extraction.property_type,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              )}
              {extraction.locations.length > 0 && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Locations</p>
                    <p className="font-medium">{extraction.locations.join(", ")}</p>
                  </div>
                </div>
              )}
              {extraction.timeline && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Timeline</p>
                    <p className="font-medium">{extraction.timeline}</p>
                  </div>
                </div>
              )}
            </div>

            {extraction.must_haves.filter((v) => v && v !== "null").length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Must-haves</p>
                <div className="flex flex-wrap gap-1">
                  {extraction.must_haves.filter((v) => v && v !== "null").map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {extraction.deal_breakers.filter((v) => v && v !== "null").length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Deal breakers</p>
                <div className="flex flex-wrap gap-1">
                  {extraction.deal_breakers.filter((v) => v && v !== "null").map((item) => (
                    <Badge key={item} variant="destructive" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {extraction.action_items.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Action Items</p>
                <ul className="text-sm list-disc pl-4 space-y-0.5">
                  {extraction.action_items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legacy action items (from Twilio debrief) */}
      {analysis.action_items && analysis.action_items.length > 0 && !extraction && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Action Items</p>
            <ul className="text-sm list-disc pl-4 space-y-0.5">
              {analysis.action_items.map((item, i) => (
                <li key={i}>{item.action}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {call.raw_content && (
        <Card>
          <CardContent className="p-3">
            <button
              type="button"
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-3 w-3" />
              {showTranscript ? "Hide transcript" : "Show transcript"}
            </button>
            {showTranscript && (
              <p className="text-sm mt-2 whitespace-pre-wrap bg-muted p-3 rounded">
                {call.raw_content}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {analysis.notes && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Agent Notes</p>
            <p className="text-sm">{analysis.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 justify-end">
        {call.lead_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              router.push(`/leads`);
              onClose();
            }}
          >
            View Lead
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function formatK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toString();
}
