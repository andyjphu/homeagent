-- Add enrichment_data JSONB column to properties table
-- This will store future enrichment data (walk score, schools, crime, flood, census)
-- For now it's nullable and unused — populated in Phase 4B
ALTER TABLE properties ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT NULL;
