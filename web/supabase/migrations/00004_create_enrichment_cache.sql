-- Enrichment cache table for storing provider results with 30-day TTL
-- Used by web/src/lib/enrichment/cache.ts

CREATE TABLE IF NOT EXISTS enrichment_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address_normalized TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  provider TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  UNIQUE(address_normalized, provider)
);

-- Fast lookups by address + provider, only for non-expired rows
CREATE INDEX idx_enrichment_cache_lookup
  ON enrichment_cache(address_normalized, provider)
  WHERE expires_at > now();

-- Allow service role to manage cache (no RLS — only accessed server-side via admin client)
ALTER TABLE enrichment_cache ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on enrichment_cache"
  ON enrichment_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);
