# PROHIBITED: Zillow search scraping has been disabled.
# Use enrichment service (lib/enrichment/) or RapidAPI aggregator instead.
#
# This debug script previously tested Zillow search extraction.
# See run_test_downstream.py for testing school, walkscore, and commute agents.
raise SystemExit(
    "Zillow search debug is disabled. Property discovery should use manual entry "
    "or the listing search API (RapidAPI)."
)
