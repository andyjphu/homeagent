import { getValueEstimate, getMarketStats } from "@/lib/rentcast/client";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RiskSignal {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  data: Record<string, unknown>;
}

interface DealData {
  id: string;
  current_offer_price: number | null;
  agreed_price: number | null;
  closing_date: string | null;
  contingencies: Record<string, string> | null;
  stage: string;
}

interface PropertyData {
  address: string;
  listing_price: number | null;
  zip: string | null;
}

/**
 * Detect risk signals for a deal by comparing deal/property data
 * against RentCast AVM and market stats.
 *
 * Uses enrichment_cache to avoid redundant RentCast API calls.
 */
export async function detectRiskSignals(
  deal: DealData,
  property: PropertyData
): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];

  // Try to get cached AVM data first, fall back to RentCast API
  const avm = await getCachedOrFetchAVM(property.address);
  const marketStats =
    property.zip ? await getCachedOrFetchMarket(property.zip) : null;

  // 1. Overpriced listing: asking price > AVM * 1.10
  if (avm && property.listing_price) {
    const ratio = property.listing_price / avm.price;
    if (ratio > 1.1) {
      const pctOver = Math.round((ratio - 1) * 100);
      signals.push({
        type: "overpriced_listing",
        severity: pctOver > 20 ? "warning" : "info",
        message: `This property may be overpriced. AVM estimate is $${avm.price.toLocaleString()} (asking $${property.listing_price.toLocaleString()}, +${pctOver}%).`,
        data: {
          avmPrice: avm.price,
          askingPrice: property.listing_price,
          percentOver: pctOver,
        },
      });
    }
  }

  // 2. Low appraisal risk: offer price > AVM * 1.05
  const offerPrice = deal.agreed_price ?? deal.current_offer_price;
  if (avm && offerPrice) {
    const ratio = offerPrice / avm.price;
    if (ratio > 1.05) {
      const pctOver = Math.round((ratio - 1) * 100);
      signals.push({
        type: "low_appraisal_risk",
        severity: pctOver > 15 ? "critical" : "warning",
        message: `Appraisal risk: offer exceeds estimated value by ${pctOver}%. AVM: $${avm.price.toLocaleString()}, offer: $${offerPrice.toLocaleString()}.`,
        data: {
          avmPrice: avm.price,
          offerPrice,
          percentOver: pctOver,
        },
      });
    }
  }

  // 3. High competition: median DOM < 14 or low listing volume
  if (marketStats && property.zip) {
    const dom = marketStats.averageDaysOnMarket;
    if (dom != null && dom < 14) {
      signals.push({
        type: "high_competition",
        severity: dom < 7 ? "warning" : "info",
        message: `Hot market: properties in ${property.zip} are selling in ${dom} days on average.`,
        data: {
          zipCode: property.zip,
          medianDaysOnMarket: dom,
          totalListings: marketStats.totalListings,
        },
      });
    }
  }

  // 4. Approaching deadlines: any contingency deadline < 48h away
  if (deal.contingencies) {
    const now = Date.now();
    const deadlineTypes: Record<string, string> = {
      inspection_deadline: "Inspection",
      appraisal_deadline: "Appraisal",
      financing_deadline: "Financing",
      title_deadline: "Title",
    };

    for (const [key, label] of Object.entries(deadlineTypes)) {
      const deadline = deal.contingencies[key];
      if (!deadline) continue;

      const deadlineTime = new Date(deadline).getTime();
      const hoursLeft = (deadlineTime - now) / (1000 * 60 * 60);

      if (hoursLeft > 0 && hoursLeft < 48) {
        signals.push({
          type: "approaching_deadline",
          severity: hoursLeft < 12 ? "critical" : "warning",
          message: `${label} deadline in ${hoursLeft < 1 ? "less than 1 hour" : `${Math.round(hoursLeft)} hours`}.`,
          data: {
            deadlineType: key,
            deadlineLabel: label,
            deadline,
            hoursLeft: Math.round(hoursLeft),
          },
        });
      }
    }
  }

  // Also check closing_date as a deadline
  if (deal.closing_date) {
    const now = Date.now();
    const closingTime = new Date(deal.closing_date).getTime();
    const hoursLeft = (closingTime - now) / (1000 * 60 * 60);

    if (hoursLeft > 0 && hoursLeft < 48) {
      signals.push({
        type: "approaching_deadline",
        severity: hoursLeft < 12 ? "critical" : "warning",
        message: `Closing deadline in ${hoursLeft < 1 ? "less than 1 hour" : `${Math.round(hoursLeft)} hours`}.`,
        data: {
          deadlineType: "closing_date",
          deadlineLabel: "Closing",
          deadline: deal.closing_date,
          hoursLeft: Math.round(hoursLeft),
        },
      });
    }
  }

  return signals;
}

// --- Cached data helpers ---

async function getCachedOrFetchAVM(address: string) {
  const supabase = createAdminClient() as any;

  // Check enrichment_cache for recent RentCast valuation
  const { data: cached } = await supabase
    .from("enrichment_cache")
    .select("data")
    .eq("address_normalized", address.toLowerCase().trim())
    .eq("provider", "rentcast_avm")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .single();

  if (cached?.data) {
    return cached.data as { price: number; priceRangeLow: number; priceRangeHigh: number };
  }

  // Fetch from RentCast
  const valuation = await getValueEstimate(address);
  if (!valuation) return null;

  // Cache for 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("enrichment_cache").upsert(
    {
      address_normalized: address.toLowerCase().trim(),
      provider: "rentcast_avm",
      data: valuation,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: "address_normalized,provider" }
  );

  return valuation;
}

async function getCachedOrFetchMarket(zipCode: string) {
  const supabase = createAdminClient() as any;

  const { data: cached } = await supabase
    .from("enrichment_cache")
    .select("data")
    .eq("address_normalized", `zip:${zipCode}`)
    .eq("provider", "rentcast_market")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .single();

  if (cached?.data) {
    return cached.data as {
      averageDaysOnMarket: number | null;
      totalListings: number | null;
      medianPrice: number | null;
    };
  }

  const stats = await getMarketStats(zipCode);
  if (!stats) return null;

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("enrichment_cache").upsert(
    {
      address_normalized: `zip:${zipCode}`,
      provider: "rentcast_market",
      data: stats,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: "address_normalized,provider" }
  );

  return stats;
}
