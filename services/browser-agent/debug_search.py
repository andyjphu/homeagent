"""Quick debug: run just the Zillow search stage and inspect results."""
import asyncio
import json
from agents.base import build_browser_session, build_llm, BaseResearchAgent
from browser_use import Agent

INTENT = {
    "preferred_areas": ["Fremont"],
    "budget_min": 600000,
    "budget_max": 800000,
    "beds_min": 3,
    "baths_min": 2,
}

async def main():
    location = INTENT["preferred_areas"][0]
    price_min = INTENT["budget_min"]
    price_max = INTENT["budget_max"]
    beds_min = INTENT["beds_min"]
    baths_min = INTENT["baths_min"]

    task = f"""Go to https://www.zillow.com/ and search for "{location}" in the search bar.
Wait for autocomplete suggestions to appear, then click the suggestion that best matches "{location}".

Once on the Zillow search results page for {location}, apply these filters:
- Price: ${price_min:,} to ${price_max:,}
- Beds: {beds_min}+
- Baths: {baths_min}+

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

    browser = build_browser_session(keep_alive=True)
    base = BaseResearchAgent(task_id="debug", agent_id="debug")

    try:
        agent = Agent(task=task, llm=build_llm(), browser=browser)
        result = await agent.run()

        print("\n" + "=" * 60)
        print("DEBUG: result type:", type(result))
        print("DEBUG: has final_result:", hasattr(result, "final_result"))
        print("DEBUG: has extracted_content:", hasattr(result, "extracted_content"))

        fr = result.final_result() if hasattr(result, "final_result") else None
        print(f"\nDEBUG: final_result() type: {type(fr)}")
        print(f"DEBUG: final_result() value ({len(str(fr))} chars):")
        print(repr(str(fr)[:500]))

        ec = result.extracted_content() if hasattr(result, "extracted_content") else None
        print(f"\nDEBUG: extracted_content() type: {type(ec)}")
        if ec:
            print(f"DEBUG: extracted_content() length: {len(ec)}")
            for i, c in enumerate(ec[:3]):
                print(f"  [{i}] ({len(str(c))} chars): {repr(str(c)[:200])}")

        # Now test extract_result
        extracted = base.extract_result(result)
        print(f"\nDEBUG: extract_result type: {type(extracted)}")
        print(f"DEBUG: extract_result value ({len(str(extracted))} chars):")
        print(repr(str(extracted)[:500]))

        # Now test parse_json
        parsed = base.parse_json(extracted)
        print(f"\nDEBUG: parse_json type: {type(parsed)}")
        if isinstance(parsed, list):
            print(f"DEBUG: parse_json returned {len(parsed)} items")
            for item in parsed[:2]:
                print(f"  {json.dumps(item)[:120]}")
        else:
            print(f"DEBUG: parse_json returned: {repr(str(parsed)[:300])}")

    finally:
        await browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
