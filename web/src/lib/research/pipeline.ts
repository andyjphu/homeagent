import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { createGmailDraft } from "@/lib/gmail/drafts";
import { getPropertyByAddress, getValueEstimate } from "@/lib/rentcast/client";
import { enrichProperty } from "@/lib/enrichment/service";
import { generateBrief } from "./brief-generator";
import { geocodioValidate, type ExtractedAddress } from "./address-extractor";
import { createActivityEntry } from "@/lib/supabase/activity";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface ProcessAddressParams {
  agentId: string;
  address: ExtractedAddress;
  triggerType: "email" | "calendar" | "manual";
  triggerSourceId?: string;
  buyerEmail?: string;
  buyerId?: string;
}

/**
 * Full research pipeline for a single address:
 * 1. Geocodio validate + normalize
 * 2. Check if property exists in DB
 * 3. If new: create property record with RentCast data
 * 4. Run enrichment pipeline
 * 5. Generate research brief
 * 6. Save to research_briefs table
 * 7. Create Gmail draft (if buyer email available)
 * 8. Log activity
 */
export async function processAddress(params: ProcessAddressParams): Promise<string | null> {
  const { agentId, address, triggerType, triggerSourceId, buyerEmail, buyerId } = params;
  const admin = createAdminClient() as any;

  console.log(`[research-pipeline] Processing "${address.address}" for agent ${agentId}`);

  // 1. Geocodio validate + normalize
  const geo = await geocodioValidate(address.address);
  const normalizedAddress = geo?.formatted || address.address;
  const lat = geo?.lat ?? 0;
  const lng = geo?.lng ?? 0;

  // 2. Check if property exists
  const { data: existingProperty } = await admin
    .from("properties")
    .select("id, enrichment_data, listing_price, beds, baths, sqft, year_built, lot_sqft, property_type")
    .eq("agent_id", agentId)
    .ilike("address", `%${normalizedAddress.split(",")[0]}%`)
    .limit(1)
    .maybeSingle();

  // 3. Fetch RentCast data
  const [rentcastProperty, rentcastValuation] = await Promise.all([
    getPropertyByAddress(normalizedAddress),
    getValueEstimate(normalizedAddress),
  ]);

  let propertyId: string;
  let existingEnrichment = existingProperty?.enrichment_data;

  if (existingProperty) {
    propertyId = existingProperty.id;

    // Update with RentCast data if available
    if (rentcastProperty) {
      await admin
        .from("properties")
        .update({
          beds: rentcastProperty.bedrooms || existingProperty.beds,
          baths: rentcastProperty.bathrooms || existingProperty.baths,
          sqft: rentcastProperty.squareFootage || existingProperty.sqft,
          year_built: rentcastProperty.yearBuilt || existingProperty.year_built,
          lot_sqft: rentcastProperty.lotSize || existingProperty.lot_sqft,
          property_type: rentcastProperty.propertyType || existingProperty.property_type,
          latitude: lat || undefined,
          longitude: lng || undefined,
          city: geo?.city || undefined,
          state: geo?.state || undefined,
          zip: geo?.zip || undefined,
        })
        .eq("id", propertyId);
    }
  } else {
    // Create new property
    const { data: newProp, error } = await admin
      .from("properties")
      .insert({
        agent_id: agentId,
        address: normalizedAddress,
        city: geo?.city || null,
        state: geo?.state || null,
        zip: geo?.zip || null,
        latitude: lat || null,
        longitude: lng || null,
        beds: rentcastProperty?.bedrooms || null,
        baths: rentcastProperty?.bathrooms || null,
        sqft: rentcastProperty?.squareFootage || null,
        year_built: rentcastProperty?.yearBuilt || null,
        lot_sqft: rentcastProperty?.lotSize || null,
        property_type: rentcastProperty?.propertyType || null,
        listing_price: rentcastValuation?.price || null,
      })
      .select("id")
      .single();

    if (error || !newProp) {
      console.error("[research-pipeline] Failed to create property:", error);
      return null;
    }
    propertyId = newProp.id;
  }

  // 4. Run enrichment if we have coordinates
  let enrichment = existingEnrichment;
  if (lat && lng) {
    try {
      const enrichResult = await enrichProperty(lat, lng, normalizedAddress);
      enrichment = enrichResult.enrichment;

      // Save enrichment to property
      await admin
        .from("properties")
        .update({ enrichment_data: enrichment })
        .eq("id", propertyId);
    } catch (err) {
      console.error("[research-pipeline] Enrichment failed:", err);
    }
  }

  // 5. Get agent voice tone
  const { data: agent } = await admin
    .from("agents")
    .select("voice_tone, email")
    .eq("id", agentId)
    .single();

  const voiceTone = agent?.voice_tone || "professional";

  // 6. Generate brief
  const propertyData = {
    address: normalizedAddress,
    beds: rentcastProperty?.bedrooms || existingProperty?.beds,
    baths: rentcastProperty?.bathrooms || existingProperty?.baths,
    sqft: rentcastProperty?.squareFootage || existingProperty?.sqft,
    year_built: rentcastProperty?.yearBuilt || existingProperty?.year_built,
    lot_sqft: rentcastProperty?.lotSize || existingProperty?.lot_sqft,
    listing_price: rentcastValuation?.price || existingProperty?.listing_price,
    property_type: rentcastProperty?.propertyType || existingProperty?.property_type,
  };

  const brief = await generateBrief(propertyData, enrichment, rentcastValuation, rentcastProperty, voiceTone);

  // 7. Save research brief
  const { data: briefRecord, error: briefError } = await admin
    .from("research_briefs")
    .insert({
      agent_id: agentId,
      property_id: propertyId,
      buyer_id: buyerId || null,
      trigger_type: triggerType,
      trigger_source_id: triggerSourceId || null,
      brief_content: brief.content,
      simplified_content: brief.simplified_content,
      enrichment_snapshot: enrichment || {},
      confidence_level: brief.confidence,
      data_sources: brief.data_sources,
      comp_count: brief.comp_count,
    })
    .select("id, public_token")
    .single();

  if (briefError || !briefRecord) {
    console.error("[research-pipeline] Failed to save brief:", briefError);
    return null;
  }

  // 8. Create Gmail draft if buyer email is available
  let draftId: string | null = null;
  if (buyerEmail) {
    try {
      const auth = await getAuthedClient(agentId);
      const briefUrl = `${APP_URL}/r/${briefRecord.public_token}`;

      const htmlBody = buildBriefEmail(brief.content, normalizedAddress, briefUrl);

      draftId = await createGmailDraft(auth, {
        to: buyerEmail,
        subject: `Research Brief: ${normalizedAddress}`,
        htmlBody,
        from: agent?.email,
      });

      // Update brief with draft info
      await admin
        .from("research_briefs")
        .update({
          delivered_via: "gmail_draft",
          gmail_draft_id: draftId,
        })
        .eq("id", briefRecord.id);
    } catch (err) {
      console.error("[research-pipeline] Gmail draft creation failed:", err);
    }
  }

  // 9. Log activity
  await createActivityEntry(
    agentId,
    "research_completed",
    `Research brief: ${normalizedAddress}`,
    `${brief.confidence} confidence brief with ${brief.data_sources.length} sources${draftId ? " — Gmail draft created" : ""}`,
    {
      property_address: normalizedAddress,
      trigger_type: triggerType,
      confidence: brief.confidence,
      data_sources: brief.data_sources,
      comp_count: brief.comp_count,
      draft_created: !!draftId,
    },
    {
      propertyId,
      buyerId,
    }
  );

  console.log(
    `[research-pipeline] Done: "${normalizedAddress}" — ${brief.confidence} confidence, ${brief.data_sources.length} sources, draft: ${!!draftId}`
  );

  return briefRecord.id;
}

function buildBriefEmail(briefContent: string, address: string, briefUrl: string): string {
  // Convert newlines to <br> for HTML
  const htmlContent = briefContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="padding: 24px 0; border-bottom: 1px solid #e5e5e5;">
    <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 600;">Research Brief</h2>
    <p style="margin: 0; color: #666; font-size: 14px;">${address}</p>
  </div>

  <div style="padding: 20px 0; font-size: 14px; line-height: 1.6;">
    ${htmlContent}
  </div>

  <div style="padding: 16px 0; border-top: 1px solid #e5e5e5;">
    <a href="${briefUrl}" style="display: inline-block; padding: 10px 20px; background: #18181b; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
      View Full Research
    </a>
  </div>

  <div style="padding: 12px 0; color: #999; font-size: 12px;">
    Generated by FoyerFind
  </div>
</div>`.trim();
}
