// Use enrichment service (lib/enrichment/) or RapidAPI aggregator instead
// of Zillow/Redfin/Realtor.com scraping. Those sites prohibit automated access.

/**
 * Build the prompt for GreatSchools school search.
 * Uses direct search URL to skip homepage navigation.
 */
export function buildSchoolSearchPrompt(address: string): string {
  const query = encodeURIComponent(address);
  return `Go to https://www.greatschools.org/search/search.page?q=${query}

This should show schools near: ${address}

Look for the assigned or nearby schools for elementary, middle, and high school levels.

For each school level (elementary, middle, high), find the top-rated assigned school and extract:
- name (school name)
- rating (GreatSchools rating, 1-10)
- distance (distance from the address, e.g. "0.5 mi")
- type (public, private, charter)

Return a JSON object with this structure:
{
  "elementary": {"name": "...", "rating": 8, "distance": "0.5 mi", "type": "public"},
  "middle": {"name": "...", "rating": 7, "distance": "1.2 mi", "type": "public"},
  "high": {"name": "...", "rating": 6, "distance": "2.0 mi", "type": "public"}
}

If a school level is not found, use null for that level.
Return ONLY the JSON object, no other text.`;
}

/**
 * Build the prompt for WalkScore lookup.
 * Uses direct address URL to skip the search step.
 */
export function buildWalkScorePrompt(address: string): string {
  // WalkScore URL format: /score/{address-slug}
  const slug = address
    .replace(/[#,.']/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `Go to https://www.walkscore.com/score/${encodeURIComponent(slug)}

If that URL doesn't show scores, go to https://www.walkscore.com/ and search for: ${address}

Extract these scores from the page:
- walk_score (0-100 integer)
- transit_score (0-100 integer, null if not available)
- bike_score (0-100 integer, null if not available)

Return a JSON object:
{
  "walk_score": 72,
  "transit_score": 45,
  "bike_score": 60
}

Return ONLY the JSON object, no other text.`;
}

/**
 * Build the prompt for Google Maps commute calculation.
 * Uses direct directions URL with origin/destination pre-filled.
 */
export function buildCommutePrompt(address: string, workplace: string): string {
  const origin = encodeURIComponent(address);
  const dest = encodeURIComponent(workplace);
  return `Go to https://www.google.com/maps/dir/${origin}/${dest}/

This should show driving directions from "${address}" to "${workplace}".

Extract the driving commute information:
- drive_minutes (estimated drive time in minutes as an integer)
- drive_miles (distance in miles as a number)

Then switch to "Transit" mode and extract:
- transit_minutes (estimated transit time in minutes as an integer, null if no transit route available)

Return a JSON object:
{
  "workplace": "${workplace}",
  "drive_minutes": 25,
  "drive_miles": 15.2,
  "transit_minutes": 45
}

Return ONLY the JSON object, no other text.`;
}
