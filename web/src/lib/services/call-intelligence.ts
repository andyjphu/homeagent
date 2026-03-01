/**
 * Call Intelligence — Keyword-based buyer intent extraction
 *
 * Parses Twilio transcription text for real estate buyer signals:
 * budget, bedrooms, bathrooms, locations, timeline, requirements.
 * No external AI API keys needed.
 */

export interface CallAnalysis {
  caller_name: string | null;
  phone: string;
  budget_range: { min: number | null; max: number | null };
  bedrooms: number | null;
  bathrooms: number | null;
  locations_mentioned: string[];
  timeline: string | null;
  must_haves: string[];
  deal_breakers: string[];
  summary: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Extract buyer intent from a call transcript using keyword/regex parsing.
 * Works entirely locally — no API keys needed.
 */
export function extractBuyerIntent(
  transcript: string,
  callerPhone: string
): CallAnalysis {
  const text = transcript.toLowerCase();

  // --- Caller Name ---
  const callerName = extractCallerName(transcript);

  // --- Budget ---
  const budget = extractBudget(text);

  // --- Bedrooms ---
  const bedrooms = extractNumber(
    text,
    /(\d+)\s*(?:bed(?:room)?s?|br|bdr)/
  );

  // --- Bathrooms ---
  const bathrooms = extractNumber(
    text,
    /(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|ba)/
  );

  // --- Locations ---
  const locations = extractLocations(transcript);

  // --- Timeline ---
  const timeline = extractTimeline(text);

  // --- Must-haves ---
  const mustHaves = extractMustHaves(text);

  // --- Deal breakers ---
  const dealBreakers = extractDealBreakers(text);

  // --- Summary ---
  const parts: string[] = [];
  if (callerName) parts.push(`${callerName} called`);
  else parts.push("Caller inquired");
  if (budget.min || budget.max) {
    const budgetStr =
      budget.min && budget.max
        ? `$${formatK(budget.min)}-$${formatK(budget.max)}`
        : budget.max
          ? `up to $${formatK(budget.max)}`
          : `from $${formatK(budget.min!)}`;
    parts.push(`with a budget of ${budgetStr}`);
  }
  if (bedrooms) parts.push(`looking for ${bedrooms} bedroom(s)`);
  if (locations.length > 0)
    parts.push(`in ${locations.slice(0, 3).join(", ")}`);
  if (timeline) parts.push(`timeline: ${timeline}`);

  const summary =
    parts.length > 1
      ? parts.join(", ") + "."
      : "Inbound call — review transcript for details.";

  // --- Confidence ---
  let score = 0;
  if (callerName) score++;
  if (budget.min || budget.max) score += 2;
  if (bedrooms) score++;
  if (locations.length > 0) score++;
  if (timeline) score++;
  if (mustHaves.length > 0) score++;

  const confidence: "high" | "medium" | "low" =
    score >= 4 ? "high" : score >= 2 ? "medium" : "low";

  return {
    caller_name: callerName,
    phone: callerPhone,
    budget_range: budget,
    bedrooms,
    bathrooms,
    locations_mentioned: locations,
    timeline,
    must_haves: mustHaves,
    deal_breakers: dealBreakers,
    summary,
    confidence,
  };
}

// ---- Helpers ----

function extractCallerName(transcript: string): string | null {
  // Patterns like "My name is John", "This is Sarah", "Hi I'm Mike Smith"
  const patterns = [
    /(?:my name is|this is|i'm|i am|it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:hey|hi|hello),?\s+(?:this is|it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      // Filter out common false positives
      const falsePositives = [
        "Looking",
        "Calling",
        "Interested",
        "Wondering",
        "Hoping",
      ];
      if (!falsePositives.includes(name)) return name;
    }
  }
  return null;
}

function extractBudget(text: string): {
  min: number | null;
  max: number | null;
} {
  let min: number | null = null;
  let max: number | null = null;

  // "$500k to $700k", "$500,000 to $700,000"
  const rangeMatch = text.match(
    /\$?\s*(\d[\d,]*\.?\d*)\s*(?:k|thousand|,000)?\s*(?:to|[-–])\s*\$?\s*(\d[\d,]*\.?\d*)\s*(?:k|thousand|,000)?/
  );
  if (rangeMatch) {
    min = parseAmount(rangeMatch[1], text.slice(rangeMatch.index, (rangeMatch.index ?? 0) + rangeMatch[0].length));
    max = parseAmount(rangeMatch[2], text.slice(rangeMatch.index, (rangeMatch.index ?? 0) + rangeMatch[0].length));
    return { min, max };
  }

  // "under $500k", "up to $600,000", "max $700k"
  const underMatch = text.match(
    /(?:under|up to|max(?:imum)?|no more than|below|at most)\s*\$?\s*(\d[\d,]*\.?\d*)\s*(?:k|thousand)?/
  );
  if (underMatch) {
    max = parseAmount(underMatch[1], underMatch[0]);
    return { min, max };
  }

  // "around $500k", "about $600,000"
  const aroundMatch = text.match(
    /(?:around|about|approximately|roughly|near)\s*\$?\s*(\d[\d,]*\.?\d*)\s*(?:k|thousand)?/
  );
  if (aroundMatch) {
    const val = parseAmount(aroundMatch[1], aroundMatch[0]);
    if (val) {
      min = Math.round(val * 0.9);
      max = Math.round(val * 1.1);
    }
    return { min, max };
  }

  // "at least $400k", "minimum $400,000", "starting at"
  const aboveMatch = text.match(
    /(?:at least|minimum|min|starting at|above|over|more than)\s*\$?\s*(\d[\d,]*\.?\d*)\s*(?:k|thousand)?/
  );
  if (aboveMatch) {
    min = parseAmount(aboveMatch[1], aboveMatch[0]);
    return { min, max };
  }

  // Standalone dollar amount — "$500k", "$500,000"
  const standaloneMatch = text.match(
    /\$\s*(\d[\d,]*\.?\d*)\s*(?:k|thousand)?/
  );
  if (standaloneMatch) {
    const val = parseAmount(standaloneMatch[1], standaloneMatch[0]);
    if (val && val >= 50000) {
      // Likely a home price
      min = Math.round(val * 0.9);
      max = Math.round(val * 1.1);
    }
    return { min, max };
  }

  return { min, max };
}

function parseAmount(numStr: string, context: string): number | null {
  const cleaned = numStr.replace(/,/g, "");
  let val = parseFloat(cleaned);
  if (isNaN(val)) return null;

  // If the context has "k" or "thousand" and the number is small, multiply
  if (
    (context.includes("k") || context.includes("thousand")) &&
    val < 10000
  ) {
    val *= 1000;
  }

  // If the value seems too small to be a home price, it might be in thousands
  if (val > 0 && val < 1000) {
    val *= 1000;
  }

  return val;
}

function extractNumber(
  text: string,
  pattern: RegExp
): number | null {
  const match = text.match(pattern);
  if (match?.[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? null : val;
  }
  return null;
}

function extractLocations(transcript: string): string[] {
  const locations: string[] = [];

  // Look for patterns like "in [Location]", "near [Location]", "around [Location]"
  const locationPatterns = [
    /(?:in|near|around|close to|by)\s+(?:the\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s+(?:area|neighborhood|district|community|suburb|city|town|region)/gi,
    /(?:in|near|around)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})(?:\s|,|\.|\?|$)/g,
    /(?:downtown|east|west|north|south)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/gi,
  ];

  const stopWords = new Set([
    "I", "The", "My", "We", "They", "And", "But", "Or", "So",
    "Looking", "Calling", "Just", "Really", "Also", "Actually",
    "Maybe", "Something", "Anything", "Thank", "Thanks", "Please",
    "Hello", "Hey", "Hi", "Bye", "Goodbye", "Yes", "No",
  ]);

  for (const pattern of locationPatterns) {
    let match;
    while ((match = pattern.exec(transcript)) !== null) {
      const loc = match[1].trim();
      if (loc.length > 2 && !stopWords.has(loc.split(" ")[0])) {
        if (!locations.includes(loc)) locations.push(loc);
      }
    }
  }

  return locations.slice(0, 5);
}

function extractTimeline(text: string): string | null {
  const patterns = [
    /(?:within|in|next|by)\s+(\d+)\s*(month|week|year|day)s?/i,
    /(?:asap|as soon as possible|immediately|right away|urgent)/i,
    /(?:by|before)\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?/i,
    /(?:end of|beginning of|start of|early|late|mid)\s+(january|february|march|april|may|june|july|august|september|october|november|december|year|summer|spring|fall|winter)/i,
    /(?:no rush|no hurry|whenever|flexible|open timeline)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function extractMustHaves(text: string): string[] {
  const items: string[] = [];
  const keywords: [RegExp, string][] = [
    [/garage/i, "garage"],
    [/pool/i, "pool"],
    [/yard|backyard|garden/i, "yard"],
    [/basement/i, "basement"],
    [/school|school district/i, "good schools"],
    [/parking/i, "parking"],
    [/updated|renovated|remodeled|new kitchen/i, "updated/renovated"],
    [/quiet|peaceful/i, "quiet neighborhood"],
    [/safe|safety|low crime/i, "safe area"],
    [/walkable|walking distance|walk to/i, "walkability"],
    [/open (?:floor )?plan|open concept/i, "open floor plan"],
    [/fireplace/i, "fireplace"],
    [/laundry|washer|dryer/i, "in-unit laundry"],
    [/balcony|patio|deck/i, "outdoor space"],
    [/storage/i, "storage"],
    [/pet friendly|pets allowed|dog|cat/i, "pet friendly"],
    [/elevator/i, "elevator"],
    [/doorman|concierge/i, "doorman/concierge"],
    [/central air|ac|air condition/i, "central air"],
    [/hardwood/i, "hardwood floors"],
  ];

  for (const [pattern, label] of keywords) {
    if (pattern.test(text) && !items.includes(label)) {
      items.push(label);
    }
  }

  return items;
}

function extractDealBreakers(text: string): string[] {
  const items: string[] = [];
  // Look for negation patterns: "no ...", "don't want ...", "not interested in ..."
  const negPatterns = [
    /(?:no|don'?t want|not interested in|avoid|stay away from|hate|can'?t do|won'?t consider)\s+([a-z\s]+?)(?:\.|,|$)/gi,
  ];

  for (const pattern of negPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item.length > 2 && item.length < 40 && !items.includes(item)) {
        items.push(item);
      }
    }
  }

  return items.slice(0, 5);
}

function formatK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toString();
}
