# PROHIBITED: Zillow scraping violates Zillow's Terms of Service.
# Use enrichment service (lib/enrichment/) or RapidAPI aggregator instead.
#
# This module is intentionally disabled. The FoyerFind data policy prohibits
# scraping Zillow, Redfin, Realtor.com, or Trulia. Properties should be
# added manually by the agent or imported via MLS API feeds.
#
# Legal data sources for property enrichment:
#   - Walk Score API (walkscore.com)
#   - GreatSchools API or NCES (schools)
#   - Google Maps API (commute, amenities)
#   - FEMA, Census, FCC, AirNow (neighborhood data)
#   - RapidAPI property aggregators (with proper licensing)

raise ImportError(
    "ZillowSearchAgent is disabled. Zillow scraping is prohibited by project policy. "
    "Use the enrichment service (lib/enrichment/) or manual property entry instead."
)
