export interface ZillowSearchIntent {
  location: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  home_type?: string;
}

/**
 * Build a Zillow search URL with filters pre-applied.
 * This skips the search bar, autocomplete, and manual filter clicking entirely.
 * Zillow URL format: /homes/{location}_rb/ with filterState query params.
 */
function buildZillowUrl(intent: ZillowSearchIntent): string {
  const {
    location,
    price_min = 300000,
    price_max = 750000,
    beds_min = 3,
    baths_min = 2,
  } = intent;

  // Zillow uses slug-style location in the path: "Austin, TX" -> "Austin,-TX"
  const locationSlug = location.replace(/\s+/g, "-").replace(/,\s*/g, ",-");

  const filterState: Record<string, any> = {
    price: { min: price_min, max: price_max },
    beds: { min: beds_min },
    baths: { min: baths_min },
    sort: { value: "globalrelevanceex" },
  };

  const params = encodeURIComponent(JSON.stringify(filterState));
  return `https://www.zillow.com/homes/${locationSlug}_rb/?searchQueryState={"filterState":${JSON.stringify(filterState)}}`;
}

/**
 * Build the prompt for Zillow search results.
 * Uses a pre-built URL with filters so Browser Use just loads and scrapes — no UI interaction needed.
 */
export function buildZillowSearchPrompt(intent: ZillowSearchIntent): string {
  const { location } = intent;
  const url = buildZillowUrl(intent);

  return `Go to this Zillow search URL: ${url}

This page should show search results for ${location} with price/beds/baths filters already applied.

If the URL doesn't load results (e.g. Zillow redirects to homepage or shows no results), fall back to:
1. Go to https://www.zillow.com/
2. Search for "${location}" in the search bar
3. Click the best matching autocomplete suggestion

If you encounter any human verification or CAPTCHA challenge, wait a few seconds and try to complete it.

Scroll through the results on this page. For each listing card visible, extract:
- address (full street address)
- price (as integer, no $ or commas)
- beds (integer)
- baths (number)
- sqft (integer)
- listing_url (the href link to the listing detail page)
- thumbnail_url (the main image src)

Return the results as a JSON array. Return ONLY the JSON array, no other text.`;
}

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
