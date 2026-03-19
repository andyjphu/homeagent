import { llmJSON, isLLMAvailable } from "@/lib/llm/router";

export interface ExtractedAddress {
  address: string;
  context: "showing" | "listing_alert" | "offer" | "general";
}

export interface GeocodioResult {
  input: { formatted_address: string };
  results: Array<{
    formatted_address: string;
    location: { lat: number; lng: number };
    address_components: {
      number: string;
      street: string;
      suffix: string;
      city: string;
      state: string;
      zip: string;
      formatted_street: string;
    };
    accuracy: number;
    accuracy_type: string;
  }>;
}

// Standard US address: number + street + suffix (+ optional unit/apt)
const ADDRESS_REGEX =
  /\b(\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-zA-Z']+\s*){1,4}(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Ct|Court|Way|Rd|Road|Pl(?:ace)?|Cir(?:cle)?|Pkwy|Parkway|Ter(?:race)?|Trl|Trail)\.?(?:\s*(?:#|Apt|Suite|Unit|Ste)\.?\s*\w+)?(?:\s*,\s*[A-Z][a-zA-Z\s]+)?(?:\s*,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?)\b/gi;

const REAL_ESTATE_KEYWORDS =
  /\b(?:showing|listing|property|MLS|open\s*house|for\s*sale|under\s*contract|pending|active|new\s*listing|price\s*(?:reduced|change)|bed(?:room)?s?\b|bath(?:room)?s?\b|sq\s*ft|square\s*feet)\b/i;

const ADDRESS_EXTRACTION_PROMPT = `You are an address extraction assistant. Extract all US property addresses from the email below.

Return a JSON object with this structure:
{
  "addresses": [
    { "address": "123 Main St, Austin, TX 78701", "context": "showing" }
  ]
}

Context should be one of: "showing" (upcoming showing/tour), "listing_alert" (new listing notification), "offer" (offer-related), "general" (other).

If no addresses are found, return: { "addresses": [] }
Only extract full street addresses with a house number. Do not extract city-only or neighborhood-only references.`;

/**
 * Extract property addresses from email content using regex + LLM hybrid approach.
 * Step 1: Regex for standard US addresses (fast, free)
 * Step 2: LLM for ambiguous cases with real estate keywords
 */
export async function extractAddresses(
  emailSubject: string,
  emailBody: string
): Promise<ExtractedAddress[]> {
  const fullText = `${emailSubject}\n${emailBody}`;

  // Step 1: Regex extraction
  const regexMatches = fullText.match(ADDRESS_REGEX) || [];
  const uniqueRegex = [...new Set(regexMatches.map((m) => m.trim()))];

  if (uniqueRegex.length > 0) {
    // Infer context from surrounding text
    return uniqueRegex.map((addr) => ({
      address: addr,
      context: inferContext(fullText, addr),
    }));
  }

  // Step 2: If no regex matches but has real estate keywords, try LLM
  if (REAL_ESTATE_KEYWORDS.test(fullText) && isLLMAvailable("address_extraction")) {
    try {
      const result = await llmJSON<{ addresses: ExtractedAddress[] }>(
        "address_extraction",
        ADDRESS_EXTRACTION_PROMPT,
        `Subject: ${emailSubject}\n\n${emailBody.slice(0, 2000)}`,
        { maxTokens: 512 }
      );
      return result.addresses || [];
    } catch (err) {
      console.warn("[address-extractor] LLM extraction failed:", err);
      return [];
    }
  }

  return [];
}

function inferContext(text: string, _address: string): ExtractedAddress["context"] {
  const lower = text.toLowerCase();
  if (/\b(?:showing|tour|schedule|visit|walkthrough)\b/.test(lower)) return "showing";
  if (/\b(?:new listing|just listed|price reduced|for sale|mls)\b/.test(lower)) return "listing_alert";
  if (/\b(?:offer|counter|accepted|under contract|earnest)\b/.test(lower)) return "offer";
  return "general";
}

/**
 * Validate and normalize an address using Geocodio.
 * Returns normalized address + lat/lng, or null if invalid.
 */
export async function geocodioValidate(
  address: string
): Promise<{ formatted: string; lat: number; lng: number; city: string; state: string; zip: string } | null> {
  const apiKey = process.env.GEOCODIO_API_KEY;
  if (!apiKey) {
    console.warn("[geocodio] No GEOCODIO_API_KEY configured, skipping validation");
    return null;
  }

  try {
    const url = new URL("https://api.geocod.io/v1.7/geocode");
    url.searchParams.set("q", address);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`[geocodio] ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as GeocodioResult;
    const top = data.results?.[0];
    if (!top || top.accuracy < 0.7) {
      console.warn(`[geocodio] Low accuracy (${top?.accuracy}) for "${address}"`);
      return null;
    }

    return {
      formatted: top.formatted_address,
      lat: top.location.lat,
      lng: top.location.lng,
      city: top.address_components.city,
      state: top.address_components.state,
      zip: top.address_components.zip,
    };
  } catch (err) {
    console.error("[geocodio] Validation error:", err);
    return null;
  }
}
