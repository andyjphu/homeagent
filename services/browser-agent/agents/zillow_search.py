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
        location = ", ".join(intent.get("preferred_areas", ["Dallas, TX"]))
        price_min = intent.get("budget_min", 300000)
        price_max = intent.get("budget_max", 750000)
        beds_min = intent.get("beds_min", 3)
        baths_min = intent.get("baths_min", 2)
        home_type = intent.get("home_type", "")

        home_type_instruction = ""
        if home_type:
            home_type_instruction = f"- Home type: {home_type}\n"

        all_listings: list[dict] = []
        browser = await self.ensure_browser()

        # Use a single Agent with add_new_task for pagination to keep the
        # same browser tab/context alive across pages.
        search_agent: Agent | None = None

        for page_num in range(1, MAX_SEARCH_PAGES + 1):
            self.log_event("search_page_start", {"page": page_num})

            if page_num == 1:
                task = f"""First go to google.com and search for "zillow homes for sale {location}".
Click on the first Zillow result link to go to Zillow's search page for {location}.

Once on Zillow, apply these filters:
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
                listings = self.parse_json(result_text)
                if isinstance(listings, list):
                    all_listings.extend(listings)
                    self.log_event("search_page_done", {
                        "page": page_num,
                        "found": len(listings),
                    })
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

        # Stage 2: Pick top candidates and deep-dive
        candidates = self._rank_candidates(all_listings, intent)
        self.log_event("candidates_selected", {"count": len(candidates)})

        saved_ids: list[str] = []

        for i, listing in enumerate(candidates, 1):
            address = listing.get("address", "unknown")
            self.log_event("detail_start", {
                "index": i, "total": len(candidates), "address": address,
            })

            detail = await self._stage_detail(listing)
            await asyncio.sleep(DEFAULT_SEARCH_DELAY_SECONDS)

            if not detail:
                continue

            # Extract listing agent info before saving property
            listing_agent_id = None
            agent_name = detail.pop("listing_agent_name", None)
            agent_brokerage = detail.pop("listing_agent_brokerage", None)
            agent_phone = detail.pop("listing_agent_phone", None)
            agent_email = detail.pop("listing_agent_email", None)

            if agent_name:
                try:
                    listing_agent_id = await self.save_listing_agent({
                        "name": agent_name,
                        "brokerage": agent_brokerage or "",
                        "phone": agent_phone,
                        "email": agent_email,
                    })
                    self.log_event("listing_agent_saved", {
                        "name": agent_name, "id": listing_agent_id,
                    })
                except Exception as e:
                    self.log_event("listing_agent_save_error", {"error": str(e)})

            # Build property data
            property_data = {
                "address": detail.get("address") or listing.get("address", "Unknown"),
                "city": detail.get("city"),
                "state": detail.get("state"),
                "zip": detail.get("zip"),
                "listing_price": detail.get("listing_price"),
                "beds": detail.get("beds"),
                "baths": detail.get("baths"),
                "sqft": detail.get("sqft"),
                "lot_sqft": detail.get("lot_sqft"),
                "year_built": detail.get("year_built"),
                "property_type": detail.get("property_type"),
                "hoa_monthly": detail.get("hoa_monthly"),
                "tax_annual": detail.get("tax_annual"),
                "tax_assessed_value": detail.get("tax_assessed_value"),
                "listing_description": detail.get("listing_description"),
                "photos": detail.get("photos", []),
                "amenities": detail.get("amenities", []),
                "days_on_market": detail.get("days_on_market"),
                "price_history": detail.get("price_history", []),
                "zillow_url": detail.get("zillow_url"),
                "zillow_id": detail.get("zillow_id"),
                "listing_status": "active",
            }

            if listing_agent_id:
                property_data["listing_agent_id"] = listing_agent_id

            try:
                prop_id = await self.save_property(property_data)
                saved_ids.append(prop_id)
                self.log_event("property_saved", {
                    "property_id": prop_id, "address": property_data["address"],
                })

                if self.buyer_id:
                    await self.link_property_to_buyer(self.buyer_id, prop_id)
            except Exception as e:
                self.log_event("property_save_error", {
                    "error": str(e), "address": property_data["address"],
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
