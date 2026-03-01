import asyncio
import json
import re
from browser_use import Agent
from agents.base import BaseResearchAgent, build_llm
from config import (
    DEFAULT_SEARCH_DELAY_SECONDS,
    MAX_DETAIL_PAGES,
    MAX_SEARCH_PAGES,
)


class ZillowSearchAgent(BaseResearchAgent):
    """Multi-stage Zillow research: search results -> detail deep-dive -> listing agent extraction."""

    # _extract_result and _parse_json are inherited from BaseResearchAgent
    # as extract_result() and parse_json()

    # ------------------------------------------------------------------
    # Stage 1: Search results scraping (up to MAX_SEARCH_PAGES pages)
    # ------------------------------------------------------------------
    async def _stage_search(self, intent: dict) -> list[dict]:
        areas = intent.get("preferred_areas", ["Dallas, TX"])
        # Use only the first area for the Zillow search — multi-city
        # confuses Zillow's autocomplete and leads to wrong results.
        location = areas[0] if areas else "Dallas, TX"
        price_min = intent.get("budget_min", 300000)
        price_max = intent.get("budget_max", 750000)
        beds_min = intent.get("beds_min", 3)
        baths_min = intent.get("baths_min", 2)
        home_type = intent.get("home_type", "")

        home_type_instruction = ""
        if home_type:
            home_type_instruction = f"- Home type: {home_type}\n"

        all_listings: list[dict] = []
        seen_urls: set[str] = set()  # dedup by listing_url
        browser = await self.ensure_browser()

        # Use a single Agent with add_new_task for pagination to keep the
        # same browser tab/context alive across pages.
        search_agent: Agent | None = None

        for page_num in range(1, MAX_SEARCH_PAGES + 1):
            self.log_event("search_page_start", {"page": page_num})

            if page_num == 1:
                task = f"""Go to https://www.zillow.com/ and search for "{location}" in the search bar.
Wait for autocomplete suggestions to appear, then click the suggestion that best matches "{location}".

Once on the Zillow search results page for {location}, apply these filters:
- Price: ${price_min:,} to ${price_max:,}
- Beds: {beds_min}+
- Baths: {baths_min}+
{home_type_instruction}
If you encounter any human verification or CAPTCHA challenge, wait a few seconds and try to complete it.

Scroll through ALL the results on this page. For each listing card visible, extract:
- address (full street address)
- price (as integer, no $ or commas)
- beds (integer)
- baths (number)
- sqft (integer)
- listing_url (the href link to the listing detail page)
- thumbnail_url (the main image src)

Return the results as a JSON array. Return ONLY the JSON array, no other text."""
            else:
                task = f"""Click the "Next" pagination button to go to page {page_num} of search results.
Wait for the page to load fully.
Scroll through ALL the results on this page. For each listing card visible, extract:
- address (full street address)
- price (as integer, no $ or commas)
- beds (integer)
- baths (number)
- sqft (integer)
- listing_url (the href link to the listing detail page)
- thumbnail_url (the main image src)

Return the results as a JSON array. Return ONLY the JSON array, no other text."""

            try:
                if search_agent is None:
                    search_agent = Agent(
                        task=task, llm=build_llm(), browser=browser,
                    )
                    result = await search_agent.run()
                else:
                    search_agent.add_new_task(task)
                    result = await search_agent.run()

                result_text = self.extract_result(result)
                print(f"[DEBUG] Page {page_num}: extract_result type={type(result_text)}, len={len(str(result_text))}")
                print(f"[DEBUG] Page {page_num}: extract_result preview: {repr(str(result_text)[:200])}")
                listings = self.parse_json(result_text)
                print(f"[DEBUG] Page {page_num}: parse_json type={type(listings)}, value={'list of '+str(len(listings)) if isinstance(listings, list) else repr(str(listings)[:100])}")
                if isinstance(listings, list):
                    new_count = 0
                    for item in listings:
                        url = item.get("listing_url", "")
                        if url and url in seen_urls:
                            continue
                        if url:
                            seen_urls.add(url)
                        all_listings.append(item)
                        new_count += 1
                    self.log_event("search_page_done", {
                        "page": page_num,
                        "found": len(listings),
                        "new": new_count,
                    })
                    # If no new listings were found, no more pages to scrape
                    if new_count == 0:
                        self.log_event("search_pagination_exhausted", {"page": page_num})
                        break
                else:
                    self.log_event("search_page_parse_error", {
                        "page": page_num,
                        "raw_preview": (result_text or "")[:300],
                    })
            except Exception as e:
                self.log_event("search_page_error", {"page": page_num, "error": str(e)})
                break

            await asyncio.sleep(DEFAULT_SEARCH_DELAY_SECONDS)

        self.log_event("search_complete", {"total_listings": len(all_listings)})
        return all_listings

    # ------------------------------------------------------------------
    # Stage 2: Detail page deep-dive for top candidates
    # ------------------------------------------------------------------
    async def _stage_detail(self, listing: dict) -> dict | None:
        url = listing.get("listing_url") or listing.get("zillow_url", "")
        address = listing.get("address", "unknown")

        if not url:
            self.log_event("detail_skip_no_url", {"address": address})
            return None

        browser = await self.ensure_browser()

        task = f"""Navigate to this Zillow listing page: {url}

Wait for the page to load fully. Extract ALL of the following information from the listing page.
If a field is not available, use null.

Return a single JSON object with these exact keys:
- address (full street address)
- city
- state (2-letter abbreviation)
- zip (5-digit zip code)
- listing_price (integer, no $ or commas)
- beds (integer)
- baths (number, e.g. 2.5)
- sqft (integer)
- lot_sqft (integer, from lot size)
- year_built (integer)
- property_type (e.g. "Single Family", "Condo", "Townhouse", "Multi-Family")
- hoa_monthly (integer, from HOA fees section, null if none)
- tax_annual (integer, from Tax History or Property Tax section)
- tax_assessed_value (integer, from Tax History section)
- listing_description (the full description text)
- photos (array of up to 10 image URLs from the photo gallery)
- amenities (array of strings from the "Facts and Features" or "Interior/Exterior" sections)
- days_on_market (integer)
- price_history (array of objects with keys: date, event, price — from the Price History table)
- zillow_url (the current page URL)
- zillow_id (the zpid number from the URL, e.g. from /homedetails/address/12345_zpid/)
- listing_agent_name (the listing agent's name if shown)
- listing_agent_brokerage (the listing agent's brokerage if shown)
- listing_agent_phone (the listing agent's phone if shown)
- listing_agent_email (the listing agent's email if shown)

Return ONLY the JSON object, no other text."""

        try:
            agent = Agent(task=task, llm=build_llm(), browser=browser)
            result = await agent.run()
            result_text = self.extract_result(result)
            data = self.parse_json(result_text)
            if isinstance(data, dict):
                self.log_event("detail_extracted", {"address": address})
                return data
            else:
                self.log_event("detail_parse_error", {
                    "address": address,
                    "raw_preview": (result_text or "")[:300],
                })
                return None
        except Exception as e:
            error_msg = str(e).lower()
            if "captcha" in error_msg or "blocked" in error_msg or "access denied" in error_msg:
                self.log_event("detail_blocked", {"address": address, "error": str(e)})
            else:
                self.log_event("detail_error", {"address": address, "error": str(e)})
            return None

    # ------------------------------------------------------------------
    # Rank candidates by price fit to buyer budget
    # ------------------------------------------------------------------
    def _rank_candidates(self, listings: list[dict], intent: dict) -> list[dict]:
        budget_max = intent.get("budget_max", 750000)
        budget_min = intent.get("budget_min", 300000)
        budget_mid = (budget_min + budget_max) / 2

        def sort_key(l):
            price = l.get("price") or l.get("listing_price") or 0
            if isinstance(price, str):
                price = int(re.sub(r"[^\d]", "", price) or "0")
            return abs(price - budget_mid)

        sorted_listings = sorted(listings, key=sort_key)
        return sorted_listings[:MAX_DETAIL_PAGES]

    # ------------------------------------------------------------------
    # Main run
    # ------------------------------------------------------------------
    async def run(self, input_params: dict) -> list[str]:
        await self.update_status("running")
        self.log_event("starting_zillow_search", input_params)

        intent = input_params.get("intent_profile", {})

        # Stage 1: Search results
        await self.create_activity(
            "research_started",
            "Zillow search started",
            description="Searching for properties matching buyer criteria",
        )

        all_listings = await self._stage_search(intent)

        if not all_listings:
            await self.update_status("completed", output_data={
                "properties_found": 0,
                "properties_saved": 0,
                "property_ids": [],
            })
            await self.save_log()
            return []

        # Save properties directly from search results (fast path).
        # Detail deep-dives are optional and very slow (~2min per property).
        candidates = self._rank_candidates(all_listings, intent)
        self.log_event("candidates_selected", {"count": len(candidates)})

        saved_ids: list[str] = []

        for i, listing in enumerate(candidates, 1):
            address = listing.get("address", "unknown")

            # Parse city/state/zip from address string
            parts = [p.strip() for p in address.split(",")]
            city = parts[1] if len(parts) > 1 else None
            state_zip = parts[2].strip().split() if len(parts) > 2 else []
            state = state_zip[0] if state_zip else None
            zip_code = state_zip[1] if len(state_zip) > 1 else None

            # Extract zillow_id from URL
            url = listing.get("listing_url", "")
            zpid_match = re.search(r"/(\d+)_zpid", url)
            zillow_id = zpid_match.group(1) if zpid_match else None

            property_data = {
                "address": address,
                "city": city,
                "state": state,
                "zip": zip_code,
                "listing_price": listing.get("price"),
                "beds": listing.get("beds"),
                "baths": listing.get("baths"),
                "sqft": listing.get("sqft"),
                "photos": [listing["thumbnail_url"]] if listing.get("thumbnail_url") else [],
                "zillow_url": url,
                "zillow_id": zillow_id,
                "listing_status": "active",
            }

            try:
                prop_id = await self.save_property(property_data)
                saved_ids.append(prop_id)
                self.log_event("property_saved", {
                    "property_id": prop_id, "address": address,
                })

                if self.buyer_id:
                    await self.link_property_to_buyer(self.buyer_id, prop_id)
            except Exception as e:
                self.log_event("property_save_error", {
                    "error": str(e), "address": address,
                })

        # Complete
        await self.update_status(
            "completed",
            output_data={
                "properties_found": len(all_listings),
                "candidates_researched": len(candidates),
                "properties_saved": len(saved_ids),
                "property_ids": saved_ids,
            },
        )

        await self.create_activity(
            "research_completed",
            f"Zillow research complete: {len(saved_ids)} properties saved",
            description=f"Found {len(all_listings)} listings, deep-dived {len(candidates)}, saved {len(saved_ids)}",
            metadata={"property_count": len(saved_ids), "property_ids": saved_ids},
        )

        await self.save_log()
        return saved_ids
