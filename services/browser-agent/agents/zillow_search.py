import asyncio
import json
from browser_use import Agent
from langchain_google_genai import ChatGoogleGenerativeAI
from agents.base import BaseResearchAgent
from config import GEMINI_API_KEY


class ZillowSearchAgent(BaseResearchAgent):
    """Searches Zillow for properties matching buyer criteria."""

    async def run(self, input_params: dict):
        await self.update_status("running")
        self.log_event("starting_zillow_search", input_params)

        intent = input_params.get("intent_profile", {})

        # Build search criteria
        location = ", ".join(intent.get("preferred_areas", ["Dallas, TX"]))
        price_min = intent.get("budget_min", 300000)
        price_max = intent.get("budget_max", 750000)
        beds_min = intent.get("beds_min", 3)
        baths_min = intent.get("baths_min", 2)

        search_task = f"""
Go to zillow.com and search for homes for sale in {location}.

Apply these filters:
- Price: ${price_min:,} to ${price_max:,}
- Beds: {beds_min}+
- Baths: {baths_min}+

For each of the first 10 listings you find, extract:
1. Full address
2. Listing price
3. Number of bedrooms
4. Number of bathrooms
5. Square footage
6. Year built
7. Lot size
8. HOA fees (if any)
9. Days on market
10. Property type (single family, condo, etc.)
11. The listing URL
12. A brief description of key features

Return the results as a JSON array of objects with these fields:
address, city, state, zip, listing_price, beds, baths, sqft, lot_sqft,
year_built, hoa_monthly, days_on_market, property_type, zillow_url, description, amenities

IMPORTANT: Return ONLY the JSON array, no other text.
"""

        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                google_api_key=GEMINI_API_KEY,
            )

            agent = Agent(
                task=search_task,
                llm=llm,
            )

            self.log_event("browser_agent_started")
            result = await agent.run()
            self.log_event("browser_agent_completed", {"result_length": len(str(result))})

            # Parse results
            result_text = str(result)

            # Try to extract JSON from the result
            properties = []
            try:
                # Find JSON array in the result
                start = result_text.find("[")
                end = result_text.rfind("]") + 1
                if start >= 0 and end > start:
                    properties = json.loads(result_text[start:end])
            except json.JSONDecodeError:
                self.log_event("json_parse_error", {"raw": result_text[:500]})

            # Save properties to database
            saved_ids = []
            for prop in properties:
                try:
                    property_data = {
                        "address": prop.get("address", "Unknown"),
                        "city": prop.get("city"),
                        "state": prop.get("state"),
                        "zip": prop.get("zip"),
                        "listing_price": prop.get("listing_price"),
                        "beds": prop.get("beds"),
                        "baths": prop.get("baths"),
                        "sqft": prop.get("sqft"),
                        "lot_sqft": prop.get("lot_sqft"),
                        "year_built": prop.get("year_built"),
                        "hoa_monthly": prop.get("hoa_monthly"),
                        "days_on_market": prop.get("days_on_market"),
                        "property_type": prop.get("property_type"),
                        "zillow_url": prop.get("zillow_url"),
                        "listing_description": prop.get("description"),
                        "amenities": prop.get("amenities", []),
                        "listing_status": "active",
                    }
                    prop_id = await self.save_property(property_data)
                    saved_ids.append(prop_id)
                    self.log_event("property_saved", {"property_id": prop_id, "address": property_data["address"]})
                except Exception as e:
                    self.log_event("property_save_error", {"error": str(e)})

            # Update task with results
            await self.update_status(
                "completed",
                output_data={
                    "properties_found": len(properties),
                    "properties_saved": len(saved_ids),
                    "property_ids": saved_ids,
                },
            )

            await self.create_activity(
                "research_completed",
                f"Research complete: {len(saved_ids)} properties found",
                description=f"Found {len(properties)} listings, saved {len(saved_ids)} to database",
                metadata={"property_count": len(saved_ids)},
            )

            await self.save_log()
            return saved_ids

        except Exception as e:
            self.log_event("error", {"error": str(e)})
            await self.update_status("failed", error=str(e))
            await self.save_log()
            raise
