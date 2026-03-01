import asyncio
import json
from browser_use import Agent
from agents.base import BaseResearchAgent, build_llm
from config import DEFAULT_SEARCH_DELAY_SECONDS


class SchoolAgent(BaseResearchAgent):
    """Looks up school ratings for a property address via greatschools.org."""

    async def run(self, input_params: dict) -> dict | None:
        address = input_params.get("address", "")
        if not address:
            self.log_event("school_skip_no_address")
            return None

        self.log_event("school_search_start", {"address": address})

        browser = await self.ensure_browser()

        task = f"""Go to greatschools.org and search for schools near this address: {address}

Look for the assigned or nearby schools for elementary, middle, and high school levels.

For each school level (elementary, middle, high), find the top-rated assigned school and extract:
- name (school name)
- rating (GreatSchools rating, 1-10)
- distance (distance from the address, e.g. "0.5 mi")
- type (public, private, charter)

Return a JSON object with this structure:
{{
  "elementary": {{"name": "...", "rating": 8, "distance": "0.5 mi", "type": "public"}},
  "middle": {{"name": "...", "rating": 7, "distance": "1.2 mi", "type": "public"}},
  "high": {{"name": "...", "rating": 6, "distance": "2.0 mi", "type": "public"}}
}}

If a school level is not found, use null for that level.
Return ONLY the JSON object, no other text."""

        try:
            agent = Agent(task=task, llm=build_llm(), browser=browser)
            result = await agent.run()

            text = self.extract_result(result)
            data = self.parse_json(text)
            if isinstance(data, dict):
                self.log_event("school_search_done", {"address": address, "data": data})
                return data

            self.log_event("school_parse_error", {"address": address, "raw_preview": (text or "")[:300]})
            return None
        except Exception as e:
            self.log_event("school_search_error", {"address": address, "error": str(e)})
            return None
        finally:
            await asyncio.sleep(DEFAULT_SEARCH_DELAY_SECONDS)
