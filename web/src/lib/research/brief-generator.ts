import { llmComplete, isLLMAvailable } from "@/lib/llm/router";
import type { PropertyEnrichment } from "@/lib/enrichment/types";
import type { RentCastProperty, RentCastValuation } from "@/lib/rentcast/client";

export interface ResearchBrief {
  content: string;
  simplified_content: string;
  confidence: "high" | "medium" | "low";
  data_sources: string[];
  comp_count: number;
}

interface PropertyData {
  address: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  year_built?: number | null;
  lot_sqft?: number | null;
  listing_price?: number | null;
  property_type?: string | null;
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional:
    "Write in a professional, confident tone. Use industry-standard terminology where appropriate but explain key figures.",
  casual:
    "Write in a warm, approachable tone. Keep it conversational and easy to understand. Avoid jargon.",
  luxury:
    "Write in a refined, upscale tone. Emphasize quality, exclusivity, and lifestyle value. Be concise but elegant.",
  first_time_buyer:
    "Write in an encouraging, educational tone. Explain every metric and term. Anticipate confusion and address it proactively.",
};

function buildBriefPrompt(
  property: PropertyData,
  enrichment: PropertyEnrichment | null,
  rentcast: RentCastValuation | null,
  rentcastProperty: RentCastProperty | null,
  agentTone: string
): string {
  const toneInstruction = TONE_INSTRUCTIONS[agentTone] || TONE_INSTRUCTIONS.professional;

  const sections: string[] = [];

  // Property basics
  const basics: string[] = [`Address: ${property.address}`];
  const beds = rentcastProperty?.bedrooms ?? property.beds;
  const baths = rentcastProperty?.bathrooms ?? property.baths;
  const sqft = rentcastProperty?.squareFootage ?? property.sqft;
  const yearBuilt = rentcastProperty?.yearBuilt ?? property.year_built;
  const lotSize = rentcastProperty?.lotSize ?? property.lot_sqft;
  const propType = rentcastProperty?.propertyType ?? property.property_type;

  if (beds) basics.push(`Bedrooms: ${beds}`);
  if (baths) basics.push(`Bathrooms: ${baths}`);
  if (sqft) basics.push(`Square feet: ${sqft.toLocaleString()}`);
  if (yearBuilt) basics.push(`Year built: ${yearBuilt}`);
  if (lotSize) basics.push(`Lot size: ${lotSize.toLocaleString()} sqft`);
  if (propType) basics.push(`Type: ${propType}`);
  if (property.listing_price) basics.push(`Listing price: $${property.listing_price.toLocaleString()}`);
  sections.push(`PROPERTY:\n${basics.join("\n")}`);

  // AVM / Valuation
  if (rentcast) {
    sections.push(
      `VALUATION (AVM):\nEstimated value: $${rentcast.price.toLocaleString()}\nRange: $${rentcast.priceRangeLow.toLocaleString()} – $${rentcast.priceRangeHigh.toLocaleString()}\nConfidence: ${rentcast.confidenceScore}\nComparable sales used: ${rentcast.comparables?.length ?? 0}`
    );
  }

  // Enrichment data
  if (enrichment) {
    if (enrichment.walkability) {
      sections.push(
        `WALKABILITY:\nWalk score: ${enrichment.walkability.walk_score}/100\nTransit score: ${enrichment.walkability.transit_score}/100\nBike score: ${enrichment.walkability.bike_score}/100`
      );
    }
    if (enrichment.flood) {
      sections.push(
        `FLOOD RISK:\nZone: ${enrichment.flood.zone}\nRisk: ${enrichment.flood.risk_level}\nInsurance required: ${enrichment.flood.insurance_required ? "Yes" : "No"}`
      );
    }
    if (enrichment.schools?.nearby?.length) {
      const top3 = enrichment.schools.nearby.slice(0, 3);
      sections.push(
        `SCHOOLS:\n${top3.map((s) => `${s.name} (${s.type}, ${s.grades}) — ${s.distance_miles}mi`).join("\n")}`
      );
    }
    if (enrichment.crime) {
      const parts: string[] = [];
      if (enrichment.crime.safety_score != null) parts.push(`Safety score: ${enrichment.crime.safety_score}/100`);
      if (enrichment.crime.violent_crime_rate != null) parts.push(`Violent crime rate: ${enrichment.crime.violent_crime_rate}`);
      if (enrichment.crime.property_crime_rate != null) parts.push(`Property crime rate: ${enrichment.crime.property_crime_rate}`);
      if (parts.length) sections.push(`CRIME:\n${parts.join("\n")}`);
    }
    if (enrichment.air_quality) {
      sections.push(`AIR QUALITY:\nAQI: ${enrichment.air_quality.aqi} (${enrichment.air_quality.category})`);
    }
    if (enrichment.broadband) {
      sections.push(
        `INTERNET:\nFiber: ${enrichment.broadband.fiber_available ? "Available" : "Not available"}\nMax download: ${enrichment.broadband.max_download_mbps} Mbps\nISPs: ${enrichment.broadband.isp_count}`
      );
    }
    if (enrichment.demographics) {
      sections.push(
        `NEIGHBORHOOD:\nMedian income: $${enrichment.demographics.median_income.toLocaleString()}\nMedian home value: $${enrichment.demographics.median_home_value.toLocaleString()}\nPopulation: ${enrichment.demographics.population.toLocaleString()}`
      );
    }
    if (enrichment.amenities) {
      sections.push(
        `AMENITIES:\nGrocery stores: ${enrichment.amenities.grocery_count}\nRestaurants: ${enrichment.amenities.restaurant_count}\nParks: ${enrichment.amenities.park_count}\nNearest grocery: ${enrichment.amenities.nearest_grocery_miles}mi`
      );
    }
  }

  return `You are a real estate research assistant generating a property brief for a buyer's agent to share with their client.

${toneInstruction}

Write a concise research brief (300-500 words) covering:
1. Property overview (key structural details)
2. Valuation analysis (if AVM data available — mention estimated value vs listing price, confidence, and comp count)
3. Neighborhood highlights (walkability, schools, safety, air quality, amenities)
4. Potential concerns (flood risk, crime, missing data)
5. Summary recommendation

Do NOT include a subject line. Start directly with the property overview.

DATA:
${sections.join("\n\n")}`;
}

/**
 * Generate a research brief for a property.
 * Merges RentCast valuation data with enrichment data and generates a narrative brief.
 */
export async function generateBrief(
  property: PropertyData,
  enrichment: PropertyEnrichment | null,
  rentcastValuation: RentCastValuation | null,
  rentcastProperty: RentCastProperty | null,
  agentTone: string
): Promise<ResearchBrief> {
  const dataSources: string[] = [];
  if (rentcastValuation) dataSources.push("RentCast AVM");
  if (rentcastProperty) dataSources.push("RentCast Property Data");
  if (enrichment?.walkability) dataSources.push("Walk Score");
  if (enrichment?.flood) dataSources.push("FEMA Flood Maps");
  if (enrichment?.schools) dataSources.push("NCES Schools");
  if (enrichment?.crime) dataSources.push("FBI Crime Data");
  if (enrichment?.air_quality) dataSources.push("AirNow");
  if (enrichment?.broadband) dataSources.push("FCC Broadband");
  if (enrichment?.demographics) dataSources.push("US Census");
  if (enrichment?.amenities) dataSources.push("Google Maps");

  const compCount = rentcastValuation?.comparables?.length ?? 0;

  // Determine confidence based on data completeness
  const sourceCount = dataSources.length;
  const confidence: ResearchBrief["confidence"] =
    sourceCount >= 6 ? "high" : sourceCount >= 3 ? "medium" : "low";

  // If no LLM available, generate a structured fallback
  if (!isLLMAvailable("brief_generation")) {
    return buildFallbackBrief(property, enrichment, rentcastValuation, dataSources, compCount, confidence);
  }

  const prompt = buildBriefPrompt(property, enrichment, rentcastValuation, rentcastProperty, agentTone);

  try {
    const content = await llmComplete(
      "brief_generation",
      prompt,
      `Generate the research brief for ${property.address}.`,
      { maxTokens: 1024 }
    );

    // Generate simplified version
    let simplified_content = content;
    try {
      simplified_content = await llmComplete(
        "brief_simplification",
        `Rewrite this property research brief in plain language that a first-time homebuyer with no real estate experience would understand. Replace all jargon (AVM, DOM, comps, contingency, etc.) with everyday words. Keep it under 300 words. Do not add a subject line.`,
        content,
        { maxTokens: 768 }
      );
    } catch {
      // If simplification fails, use the original
      console.warn("[brief-generator] Simplification failed, using original");
    }

    return { content, simplified_content, confidence, data_sources: dataSources, comp_count: compCount };
  } catch (err) {
    console.error("[brief-generator] LLM generation failed:", err);
    return buildFallbackBrief(property, enrichment, rentcastValuation, dataSources, compCount, confidence);
  }
}

function buildFallbackBrief(
  property: PropertyData,
  enrichment: PropertyEnrichment | null,
  rentcast: RentCastValuation | null,
  dataSources: string[],
  compCount: number,
  confidence: ResearchBrief["confidence"]
): ResearchBrief {
  const lines: string[] = [];
  lines.push(`Property Research: ${property.address}`);
  lines.push("");

  if (property.beds || property.baths || property.sqft) {
    const parts: string[] = [];
    if (property.beds) parts.push(`${property.beds} bed`);
    if (property.baths) parts.push(`${property.baths} bath`);
    if (property.sqft) parts.push(`${property.sqft.toLocaleString()} sqft`);
    lines.push(parts.join(" | "));
  }

  if (property.listing_price) {
    lines.push(`Listing price: $${property.listing_price.toLocaleString()}`);
  }

  if (rentcast) {
    lines.push("");
    lines.push(`Estimated value: $${rentcast.price.toLocaleString()} (range: $${rentcast.priceRangeLow.toLocaleString()} – $${rentcast.priceRangeHigh.toLocaleString()})`);
    lines.push(`Based on ${compCount} comparable sales`);
  }

  if (enrichment?.walkability) {
    lines.push("");
    lines.push(`Walk Score: ${enrichment.walkability.walk_score}/100`);
  }

  if (enrichment?.flood) {
    lines.push(`Flood Zone: ${enrichment.flood.zone} (${enrichment.flood.risk_level} risk)`);
  }

  lines.push("");
  lines.push(`Data sources: ${dataSources.join(", ")}`);
  lines.push(`Confidence: ${confidence}`);

  const content = lines.join("\n");
  return { content, simplified_content: content, confidence, data_sources: dataSources, comp_count: compCount };
}
