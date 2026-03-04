/**
 * Keyword-based email classification fallback.
 * Used when LLM API keys are not configured or LLM calls fail.
 */

interface KeywordClassification {
  classification: "new_lead" | "deal_relevant" | "action_required" | "noise";
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

// Buying-intent signals
const BUYING_INTENT_KEYWORDS = [
  "looking to buy",
  "want to buy",
  "interested in buying",
  "pre-approved",
  "pre-qualification",
  "preapproved",
  "mortgage approved",
  "budget",
  "price range",
  "move-in date",
  "move in date",
  "looking for a home",
  "looking for a house",
  "house hunting",
  "home search",
  "first-time buyer",
  "first time buyer",
  "ready to purchase",
  "bedrooms",
  "bathrooms",
  "square feet",
  "sqft",
];

// Agent/realtor signals (combined with location = likely lead)
const AGENT_SIGNALS = [
  "realtor",
  "real estate agent",
  "buyer's agent",
  "buyers agent",
  "buyer agent",
  "representation",
  "showing",
  "open house",
];

// Location mentions (strong signal when combined with other keywords)
const LOCATION_PATTERNS = [
  /\b\d{5}\b/, // zip codes
  /\b(?:neighborhood|area|suburb|district|county|city of)\b/i,
  /\b(?:downtown|midtown|uptown|east side|west side|north side|south side)\b/i,
];

// Action-required signals
const ACTION_KEYWORDS = [
  "please respond",
  "by tomorrow",
  "deadline",
  "urgent",
  "asap",
  "time sensitive",
  "expires",
  "due date",
  "sign by",
  "review and sign",
  "document needed",
  "need your",
  "action required",
  "showing request",
  "schedule a showing",
  "can we tour",
];

// Deal-relevant signals
const DEAL_KEYWORDS = [
  "offer",
  "counter offer",
  "counteroffer",
  "inspection",
  "appraisal",
  "closing",
  "escrow",
  "contingency",
  "earnest money",
  "title company",
  "under contract",
  "accepted offer",
  "purchase agreement",
  "amendment",
  "addendum",
  "repair request",
  "home warranty",
];

// Noise signals
const NOISE_KEYWORDS = [
  "unsubscribe",
  "newsletter",
  "marketing",
  "promotional",
  "no-reply",
  "noreply",
  "do not reply",
  "automated message",
  "notification settings",
  "update your preferences",
  "view in browser",
  "weekly digest",
  "monthly report",
];

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
}

function hasPatternMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function classifyByKeywords(
  subject: string,
  body: string,
  from: string
): KeywordClassification {
  const fullText = `${subject} ${body}`.toLowerCase();
  const fromLower = from.toLowerCase();

  // Check noise first
  const noiseScore = countMatches(fullText, NOISE_KEYWORDS);
  if (noiseScore >= 2 || fromLower.includes("noreply") || fromLower.includes("no-reply")) {
    return {
      classification: "noise",
      confidence: noiseScore >= 3 ? "high" : "medium",
      reasoning: `Keyword fallback: matched ${noiseScore} noise indicators`,
    };
  }

  // Check buying intent
  const buyingScore = countMatches(fullText, BUYING_INTENT_KEYWORDS);
  const agentScore = countMatches(fullText, AGENT_SIGNALS);
  const hasLocation = hasPatternMatch(fullText, LOCATION_PATTERNS);

  if (buyingScore >= 2 || (buyingScore >= 1 && (agentScore >= 1 || hasLocation))) {
    return {
      classification: "new_lead",
      confidence: buyingScore >= 3 ? "high" : "medium",
      reasoning: `Keyword fallback: ${buyingScore} buying-intent keywords${hasLocation ? " + location mention" : ""}${agentScore > 0 ? " + agent reference" : ""}`,
    };
  }

  // Check deal-relevant
  const dealScore = countMatches(fullText, DEAL_KEYWORDS);
  if (dealScore >= 2) {
    return {
      classification: "deal_relevant",
      confidence: dealScore >= 3 ? "high" : "medium",
      reasoning: `Keyword fallback: ${dealScore} deal-related keywords`,
    };
  }

  // Check action-required
  const actionScore = countMatches(fullText, ACTION_KEYWORDS);
  if (actionScore >= 1) {
    return {
      classification: "action_required",
      confidence: actionScore >= 2 ? "medium" : "low",
      reasoning: `Keyword fallback: ${actionScore} action-required keywords`,
    };
  }

  // Single deal keyword is still relevant
  if (dealScore === 1) {
    return {
      classification: "deal_relevant",
      confidence: "low",
      reasoning: `Keyword fallback: ${dealScore} deal-related keyword`,
    };
  }

  // Default to noise
  return {
    classification: "noise",
    confidence: "low",
    reasoning: "Keyword fallback: no significant real estate signals detected",
  };
}
