import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderResult } from "./types";

// Supabase TS inference returns `never` for tables not in generated types.
// The enrichment_cache table was added manually. Using `as any` on admin client
// follows the existing codebase pattern (see web/src/app/api/properties/route.ts).

interface CacheRow {
  provider: string;
  data: Record<string, unknown>;
  fetched_at: string;
  expires_at: string;
}

/**
 * Normalize address for cache key: lowercase, collapse whitespace, strip punctuation.
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check cache for a provider result. Returns null if not cached or expired.
 */
export async function getCached(
  address: string,
  provider: string
): Promise<ProviderResult | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const normalized = normalizeAddress(address);

  const { data, error } = await supabase
    .from("enrichment_cache")
    .select("data, fetched_at, expires_at")
    .eq("address_normalized", normalized)
    .eq("provider", provider)
    .gt("expires_at", new Date().toISOString())
    .single();

  const row = data as CacheRow | null;
  if (error || !row) return null;

  return {
    provider,
    success: true,
    data: row.data,
  };
}

/**
 * Check cache for all providers at once. Returns a map of provider -> result.
 */
export async function getCachedAll(
  address: string
): Promise<Map<string, ProviderResult>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const normalized = normalizeAddress(address);
  const results = new Map<string, ProviderResult>();

  const { data, error } = await supabase
    .from("enrichment_cache")
    .select("provider, data, fetched_at")
    .eq("address_normalized", normalized)
    .gt("expires_at", new Date().toISOString());

  const rows = data as CacheRow[] | null;
  if (error || !rows) return results;

  for (const row of rows) {
    results.set(row.provider, {
      provider: row.provider,
      success: true,
      data: row.data,
    });
  }

  return results;
}

/**
 * Store a provider result in cache with 30-day TTL.
 */
export async function setCache(
  address: string,
  lat: number | null,
  lng: number | null,
  provider: string,
  data: Record<string, unknown>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const normalized = normalizeAddress(address);

  const { error } = await supabase.from("enrichment_cache").upsert(
    {
      address_normalized: normalized,
      lat,
      lng,
      provider,
      data,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
    { onConflict: "address_normalized,provider" }
  );

  if (error) {
    console.error(`[enrichment-cache] Failed to cache ${provider}:`, error.message);
  }
}
