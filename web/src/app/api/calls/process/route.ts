import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";
import { extractBuyerIntent } from "@/lib/services/call-intelligence";
import { isLLMAvailable, llmJSON } from "@/lib/llm/router";
import { CALL_LEAD_EXTRACTION_PROMPT } from "@/lib/llm/prompts/call-extraction";

export const maxDuration = 300;

interface ProcessRequest {
  communicationId: string;
  agentId: string;
  hasAudio: boolean;
  hasTranscript: boolean;
  transcriptText: string | null;
  callerPhone: string;
  callerName: string | null;
  buyerId: string | null;
  storagePath: string | null;
}

interface LLMExtraction {
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
  pre_approved: boolean | null;
  urgency: "high" | "medium" | "low";
  sentiment: "positive" | "neutral" | "negative";
  is_real_estate_related: boolean;
  summary: string;
  action_items: string[];
}

export async function POST(request: Request) {
  try {
    const body: ProcessRequest = await request.json();
    const {
      communicationId,
      agentId,
      hasAudio,
      hasTranscript,
      transcriptText,
      callerPhone,
      callerName,
      buyerId,
      storagePath,
    } = body;

    const admin = createAdminClient() as any;
    let transcript = transcriptText;

    // Step 1: Transcription (if audio only, no transcript)
    if (hasAudio && !hasTranscript && storagePath) {
      transcript = await transcribeAudio(admin, storagePath);

      if (transcript) {
        await admin
          .from("communications")
          .update({
            raw_content: transcript,
            ai_analysis: {
              status: "transcribed",
              source: "whisper",
              storage_path: storagePath,
              caller_name: callerName,
            },
          })
          .eq("id", communicationId);
      } else {
        // No transcription available — mark as needing manual review
        await admin
          .from("communications")
          .update({
            ai_analysis: {
              status: "awaiting_manual_transcript",
              source: "upload",
              storage_path: storagePath,
              caller_name: callerName,
              message: "Audio uploaded but transcription unavailable. Paste a transcript to analyze.",
            },
          })
          .eq("id", communicationId);
        return NextResponse.json({ status: "awaiting_transcript" });
      }
    }

    // Step 2: Lead extraction
    if (!transcript) {
      await admin
        .from("communications")
        .update({
          is_processed: true,
          processed_at: new Date().toISOString(),
          ai_analysis: {
            status: "processed",
            source: "upload",
            storage_path: storagePath,
            caller_name: callerName,
            message: "No transcript available for analysis.",
          },
        })
        .eq("id", communicationId);
      return NextResponse.json({ status: "no_transcript" });
    }

    let extraction: LLMExtraction | null = null;
    let extractionSource: "llm" | "keyword" = "keyword";

    // Try LLM extraction first
    if (isLLMAvailable("lead_classification")) {
      try {
        extraction = await llmJSON<LLMExtraction>(
          "lead_classification",
          CALL_LEAD_EXTRACTION_PROMPT,
          `Call transcript:\n\n${transcript}`
        );
        extractionSource = "llm";
      } catch (err) {
        console.error("[call-process] LLM extraction failed, falling back to keyword:", err);
      }
    }

    // Fallback: keyword-based extraction
    let keywordAnalysis;
    if (!extraction) {
      keywordAnalysis = extractBuyerIntent(transcript, callerPhone);
      extraction = {
        caller_name: keywordAnalysis.caller_name,
        phone: keywordAnalysis.phone,
        email: null,
        budget_min: keywordAnalysis.budget_range.min,
        budget_max: keywordAnalysis.budget_range.max,
        bedrooms: keywordAnalysis.bedrooms,
        bathrooms: keywordAnalysis.bathrooms,
        locations: keywordAnalysis.locations_mentioned,
        property_type: null,
        timeline: keywordAnalysis.timeline,
        must_haves: keywordAnalysis.must_haves,
        deal_breakers: keywordAnalysis.deal_breakers,
        pre_approved: null,
        urgency: keywordAnalysis.confidence === "high" ? "medium" : "low",
        sentiment: "neutral",
        is_real_estate_related: true,
        summary: keywordAnalysis.summary,
        action_items: [],
      };
    }

    // Determine confidence
    let fieldCount = 0;
    if (extraction.caller_name) fieldCount++;
    if (extraction.budget_min || extraction.budget_max) fieldCount += 2;
    if (extraction.bedrooms) fieldCount++;
    if (extraction.locations.length > 0) fieldCount++;
    if (extraction.timeline) fieldCount++;
    if (extraction.must_haves.length > 0) fieldCount++;

    const confidence: "high" | "medium" | "low" =
      fieldCount >= 4 ? "high" : fieldCount >= 2 ? "medium" : "low";

    // Downgrade confidence for keyword-only or summary-only
    const finalConfidence: "high" | "medium" | "low" =
      extractionSource === "keyword"
        ? (confidence === "high" ? "medium" : confidence)
        : confidence;

    // Update communication record
    await admin
      .from("communications")
      .update({
        raw_content: transcript,
        is_processed: true,
        processed_at: new Date().toISOString(),
        ai_analysis: {
          status: "processed",
          source: extractionSource,
          storage_path: storagePath,
          caller_name: extraction.caller_name || callerName,
          extraction,
          summary: extraction.summary,
        },
      })
      .eq("id", communicationId);

    // Step 3: Lead creation or buyer linking
    if (extraction.is_real_estate_related !== false) {
      if (buyerId) {
        // Link communication to existing buyer — don't create a new lead
        await admin
          .from("communications")
          .update({ buyer_id: buyerId })
          .eq("id", communicationId);
      } else if (finalConfidence !== "low" || extraction.caller_name || callerPhone) {
        // Create a draft lead
        const resolvedName =
          extraction.caller_name ||
          callerName ||
          (callerPhone ? `Caller ${callerPhone}` : "Unknown caller");

        const { data: lead } = await admin
          .from("leads")
          .insert({
            agent_id: agentId,
            source: "call" as const,
            status: "draft" as const,
            confidence: finalConfidence,
            name: resolvedName,
            phone: extraction.phone || callerPhone || null,
            email: extraction.email || null,
            raw_source_content: transcript,
            extracted_info: {
              budget_min: extraction.budget_min,
              budget_max: extraction.budget_max,
              beds: extraction.bedrooms,
              baths: extraction.bathrooms,
              areas: extraction.locations,
              timeline: extraction.timeline,
              property_type: extraction.property_type,
              must_haves: extraction.must_haves,
              deal_breakers: extraction.deal_breakers,
              pre_approved: extraction.pre_approved,
              urgency: extraction.urgency,
              action_items: extraction.action_items,
              summary: extraction.summary,
            },
            source_communication_id: communicationId,
          })
          .select("id")
          .single();

        if (lead) {
          await admin
            .from("communications")
            .update({ lead_id: lead.id })
            .eq("id", communicationId);
        }
      }
    }

    // Activity entry for analysis completion
    await createActivityEntry(
      agentId,
      "call_analyzed",
      extraction.caller_name || callerName
        ? `Call analyzed: ${extraction.caller_name || callerName}`
        : "Call analyzed",
      extraction.summary || undefined,
      {
        extraction_source: extractionSource,
        confidence: finalConfidence,
        is_real_estate: extraction.is_real_estate_related,
      },
      { communicationId, buyerId: buyerId || undefined }
    );

    return NextResponse.json({ status: "processed", extraction });
  } catch (err) {
    console.error("[call-process] Unexpected error:", err);

    // Try to mark the communication as failed
    try {
      const body = await request.clone().json();
      if (body.communicationId) {
        const admin = createAdminClient() as any;
        await admin
          .from("communications")
          .update({
            ai_analysis: {
              status: "failed",
              error: err instanceof Error ? err.message : "Unknown error",
            },
          })
          .eq("id", body.communicationId);
      }
    } catch {
      // Ignore — best effort
    }

    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Transcribe audio using OpenAI Whisper API.
 * Returns transcript text or null if unavailable.
 */
async function transcribeAudio(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log("[call-process] No OPENAI_API_KEY — skipping Whisper transcription");
    return null;
  }

  try {
    // Download audio from Supabase Storage
    const { data: audioData, error: downloadError } = await (admin as any).storage
      .from("call-recordings")
      .download(storagePath);

    if (downloadError || !audioData) {
      console.error("[call-process] Failed to download audio:", downloadError);
      return null;
    }

    // Get file extension for Whisper
    const ext = storagePath.split(".").pop() || "m4a";
    const filename = `recording.${ext}`;

    // Send to Whisper API
    const formData = new FormData();
    formData.append("file", new Blob([await audioData.arrayBuffer()]), filename);
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[call-process] Whisper API error:", response.status, errText);
      return null;
    }

    const result = await response.json();
    return result.text || null;
  } catch (err) {
    console.error("[call-process] Whisper transcription failed:", err);
    return null;
  }
}
