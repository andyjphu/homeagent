import asyncio
import json
from browser_use import Agent
from agents.base import BaseResearchAgent, build_llm
from config import DEFAULT_SEARCH_DELAY_SECONDS


class WalkScoreAgent(BaseResearchAgent):
    """Looks up Walk Score, Transit Score, and Bike Score for a property address."""

    async def run(self, input_params: dict) -> dict | None:
        address = input_params.get("address", "")
        if not address:
            self.log_event("walkscore_skip_no_address")
            return None

        self.log_event("walkscore_search_start", {"address": address})

        browser = await self.ensure_browser()

        task = f"""Go to walkscore.com and search for this address: {address}

Wait for the results to load. Extract these scores from the page:
- walk_score (0-100 integer)
- transit_score (0-100 integer, null if not available)
- bike_score (0-100 integer, null if not available)

Return a JSON object:
{{
  "walk_score": 72,
  "transit_score": 45,
  "bike_score": 60
}}

Return ONLY the JSON object, no other text."""

        try:
            agent = Agent(task=task, llm=build_llm(), browser=browser)
            result = await agent.run()

            text = self.extract_result(result)
            data = self.parse_json(text)
            if isinstance(data, dict):
                self.log_event("walkscore_search_done", {"address": address, "data": data})
                return data

            self.log_event("walkscore_parse_error", {"address": address, "raw_preview": (text or "")[:300]})
            return None
        except Exception as e:
            self.log_event("walkscore_search_error", {"address": address, "error": str(e)})
            return None
        finally:
            await asyncio.sleep(DEFAULT_SEARCH_DELAY_SECONDS)
