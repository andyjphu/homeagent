# PROHIBITED: Zillow search scraping has been disabled.
# Use enrichment service (lib/enrichment/) or RapidAPI aggregator instead.
#
# This test previously ran a Zillow search agent.
# The primary workflow for adding properties is now manual entry + API enrichment.
# Use run_test_downstream.py to test the enrichment agents (school, walkscore, commute).
raise SystemExit(
    "Zillow search tests are disabled. Property discovery should use manual entry "
    "or the listing search API (RapidAPI). Use run_test_downstream.py to test enrichment."
)
