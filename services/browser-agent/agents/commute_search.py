import asyncio
import json
from browser_use import Agent
from agents.base import BaseResearchAgent, build_llm, build_browser_session
from config import DEFAULT_SEARCH_DELAY_SECONDS


class CommuteAgent(BaseResearchAgent):
    """Looks up commute time from a property address to a workplace via Google Maps."""

    async def run(self, input_params: dict) -> dict | None:
        address = input_params.get("address", "")
        workplace = input_params.get("workplace", "")
        if not address or not workplace:
            self.log_event("commute_skip_missing_params", {
                "has_address": bool(address),
                "has_workplace": bool(workplace),
            })
            return None

        self.log_event("commute_search_start", {"address": address, "workplace": workplace})

        task = f"""Go to Google Maps (maps.google.com).
Click on "Directions".
Set the origin to: {address}
Set the destination to: {workplace}

Make sure the travel mode is set to "Driving". Look for the departure time option and set it to "Depart at" 8:00 AM on a weekday (e.g. next Monday).

Extract the driving commute information:
- drive_minutes (estimated drive time in minutes as an integer)
- drive_miles (distance in miles as a number)

Then switch to "Transit" mode and extract:
- transit_minutes (estimated transit time in minutes as an integer, null if no transit route available)

Return a JSON object:
{{
  "workplace": "{workplace}",
  "drive_minutes": 25,
  "drive_miles": 15.2,
  "transit_minutes": 45
}}

Return ONLY the JSON object, no other text."""

        try:
            agent = Agent(task=task, llm=build_llm(), browser_session=build_browser_session())
            result = await agent.run()

            text = result.final_result() if hasattr(result, "final_result") else str(result)
            if text:
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    data = json.loads(text[start:end])
                    self.log_event("commute_search_done", {"address": address, "data": data})
                    return data

            self.log_event("commute_parse_error", {"address": address})
            return None
        except Exception as e:
            self.log_event("commute_search_error", {"address": address, "error": str(e)})
            return None
        finally:
            await asyncio.sleep(DEFAULT_SEARCH_DELAY_SECONDS)
