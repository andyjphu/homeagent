"""
Test runner for downstream agents: detail extraction + cross-reference (school, walkscore, commute).
Seeds the DB with listings from the search run, then tests each agent individually.

Usage: python run_test_downstream.py
"""

import asyncio
import uuid
import json
from db.supabase_client import supabase
from agents.zillow_search import ZillowSearchAgent
from agents.school_search import SchoolAgent
from agents.walkscore_search import WalkScoreAgent
from agents.commute_search import CommuteAgent
from agents.base import build_browser_session

AGENT_ID = "f307307e-a606-4e4f-893a-6bdea6a8cc6a"

# Listings captured from the search run
TEST_LISTINGS = [
    {
        "address": "6226 La Cosa Dr",
        "city": "Dallas",
        "state": "TX",
        "zip": "75248",
        "listing_price": 540000,
        "beds": 4,
        "baths": 3,
        "sqft": 2636,
        "zillow_url": "https://www.zillow.com/homedetails/6226-La-Cosa-Dr-Dallas-TX-75248/26888826_zpid/",
        "listing_status": "active",
    },
    {
        "address": "9671 Fallbrook Dr",
        "city": "Dallas",
        "state": "TX",
        "zip": "75243",
        "listing_price": 650000,
        "beds": 3,
        "baths": 3,
        "sqft": 2789,
        "zillow_url": "https://www.zillow.com/homedetails/9671-Fallbrook-Dr-Dallas-TX-75243/26869016_zpid/",
        "listing_status": "active",
    },
]

WORKPLACE = "500 N Akard St, Dallas, TX 75201"  # Downtown Dallas


async def seed_properties() -> list[dict]:
    """Insert test listings into Supabase and return them with IDs."""
    seeded = []
    for listing in TEST_LISTINGS:
        data = {**listing, "agent_id": AGENT_ID}
        result = supabase.table("properties").insert(data).execute()
        row = result.data[0]
        seeded.append(row)
        print(f"  Seeded: {row['address']}, {row['city']} (ID: {row['id'][:12]}...)")
    return seeded


async def test_detail(browser, property_row: dict):
    """Test the detail page deep-dive on a single property."""
    task_id = str(uuid.uuid4())
    supabase.table("agent_tasks").insert({
        "id": task_id,
        "agent_id": AGENT_ID,
        "task_type": "property_detail",
        "status": "queued",
        "input_params": {},
    }).execute()

    agent = ZillowSearchAgent(task_id, AGENT_ID, browser=browser)
    listing = {
        "address": property_row["address"],
        "listing_url": property_row["zillow_url"],
    }
    detail = await agent._stage_detail(listing)
    if detail:
        print(f"  Detail extracted: {json.dumps(detail, indent=2)[:500]}...")
    else:
        print("  Detail extraction returned None")
    return detail


async def test_school(browser, full_address: str):
    """Test school rating lookup."""
    task_id = str(uuid.uuid4())
    supabase.table("agent_tasks").insert({
        "id": task_id,
        "agent_id": AGENT_ID,
        "task_type": "cross_reference",
        "status": "queued",
        "input_params": {},
    }).execute()

    agent = SchoolAgent(task_id, AGENT_ID, browser=browser)
    result = await agent.run({"address": full_address})
    if result:
        print(f"  Schools: {json.dumps(result, indent=2)}")
    else:
        print("  School lookup returned None")
    return result


async def test_walkscore(browser, full_address: str):
    """Test walk score lookup."""
    task_id = str(uuid.uuid4())
    supabase.table("agent_tasks").insert({
        "id": task_id,
        "agent_id": AGENT_ID,
        "task_type": "cross_reference",
        "status": "queued",
        "input_params": {},
    }).execute()

    agent = WalkScoreAgent(task_id, AGENT_ID, browser=browser)
    result = await agent.run({"address": full_address})
    if result:
        print(f"  Walk Score: {json.dumps(result, indent=2)}")
    else:
        print("  Walk score lookup returned None")
    return result


async def test_commute(browser, full_address: str):
    """Test commute lookup."""
    task_id = str(uuid.uuid4())
    supabase.table("agent_tasks").insert({
        "id": task_id,
        "agent_id": AGENT_ID,
        "task_type": "cross_reference",
        "status": "queued",
        "input_params": {},
    }).execute()

    agent = CommuteAgent(task_id, AGENT_ID, browser=browser)
    result = await agent.run({"address": full_address, "workplace": WORKPLACE})
    if result:
        print(f"  Commute: {json.dumps(result, indent=2)}")
    else:
        print("  Commute lookup returned None")
    return result


async def main():
    print("=" * 60)
    print("DOWNSTREAM PIPELINE TEST")
    print("=" * 60)

    # 1. Seed properties
    print("\n[1] Seeding properties...")
    properties = await seed_properties()
    test_property = properties[0]
    full_address = f"{test_property['address']}, {test_property['city']}, {test_property['state']} {test_property['zip']}"
    print(f"\nTest property: {full_address}")
    print(f"Zillow URL: {test_property['zillow_url']}")
    print(f"Workplace: {WORKPLACE}")

    # Build shared browser
    browser = build_browser_session(keep_alive=True)

    try:
        # 2. Detail extraction
        print(f"\n{'='*60}")
        print("[2] Testing DETAIL PAGE extraction...")
        print(f"{'='*60}")
        detail = await test_detail(browser, test_property)

        # 3. School ratings
        print(f"\n{'='*60}")
        print("[3] Testing SCHOOL RATINGS lookup...")
        print(f"{'='*60}")
        schools = await test_school(browser, full_address)

        # 4. Walk Score
        print(f"\n{'='*60}")
        print("[4] Testing WALK SCORE lookup...")
        print(f"{'='*60}")
        walkscore = await test_walkscore(browser, full_address)

        # 5. Commute
        print(f"\n{'='*60}")
        print("[5] Testing COMMUTE lookup...")
        print(f"{'='*60}")
        commute = await test_commute(browser, full_address)

        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"  Detail extraction: {'PASS' if detail else 'FAIL'}")
        print(f"  School ratings:    {'PASS' if schools else 'FAIL'}")
        print(f"  Walk score:        {'PASS' if walkscore else 'FAIL'}")
        print(f"  Commute data:      {'PASS' if commute else 'FAIL'}")

    finally:
        await browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
