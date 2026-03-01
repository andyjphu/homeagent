-- Add unique constraint on zillow_url for property upsert deduplication
CREATE UNIQUE INDEX idx_properties_zillow_url ON properties(zillow_url) WHERE zillow_url IS NOT NULL;
