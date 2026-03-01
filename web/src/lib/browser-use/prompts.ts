export interface ZillowSearchIntent {
  location: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  home_type?: string;
}

/**
 * Build the prompt for Zillow search results.
 * Goes directly to zillow.com and uses the search bar (matches updated Python agent).
 */
export function buildZillowSearchPrompt(intent: ZillowSearchIntent): string {
  const {
    location,
    price_min = 300000,
    price_max = 750000,
    beds_min = 3,
    baths_min = 2,
    home_type = "",
  } = intent;

  const homeTypeInstruction = home_type
    ? `- Home type: ${home_type}\n`
    : "";

  return `Go to https://www.zillow.com/ and search for "${location}" in the search bar.
Wait for autocomplete suggestions to appear, then click the suggestion that best matches "${location}".

Once on the Zillow search results page for ${location}, apply these filters:
- Price: $${price_min.toLocaleString()} to $${price_max.toLocaleString()}
- Beds: ${beds_min}+
- Baths: ${baths_min}+
${homeTypeInstruction}
If you encounter any human verification or CAPTCHA challenge, wait a few seconds and try to complete it.

Scroll through ALL the results on this page. For each listing card visible, extract:
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
 */
export function buildSchoolSearchPrompt(address: string): string {
  return `Go to greatschools.org and search for schools near this address: ${address}

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
 */
export function buildWalkScorePrompt(address: string): string {
  return `Go to walkscore.com and search for this address: ${address}

Wait for the results to load. Extract these scores from the page:
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
 */
export function buildCommutePrompt(address: string, workplace: string): string {
  return `Go to Google Maps (maps.google.com).
Click on "Directions".
Set the origin to: ${address}
Set the destination to: ${workplace}

Make sure the travel mode is set to "Driving". Look for the departure time option and set it to "Depart at" 8:00 AM on a weekday (e.g. next Monday).

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
