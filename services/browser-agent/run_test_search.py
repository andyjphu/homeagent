"""
Test runner: Creates a task in Supabase and runs a Zillow search via browser-use.
Usage: python run_test_search.py
"""

import asyncio
import uuid
import json
from datetime import datetime
from db.supabase_client import supabase
from agents.zillow_search import ZillowSearchAgent
from agents.base import build_browser_session

# ── Config ──────────────────────────────────────────────────────
AGENT_ID = "33b6d441-dda7-44df-b226-e2e9241be14b"  # Andy Phu

INTENT_PROFILE = {
    "preferred_areas": ["Dallas, TX"],
    "budget_min": 500000,
    "budget_max": 750000,
    "beds_min": 3,
    "baths_min": 2,
    "home_type": "",  # blank = all types
}
# ────────────────────────────────────────────────────────────────


async def main():
    task_id = str(uuid.uuid4())
    print(f"Task ID: {task_id}")
    print(f"Profile: {json.dumps(INTENT_PROFILE, indent=2)}")
    print()

    # Create task row in Supabase
    supabase.table("agent_tasks").insert({
        "id": task_id,
        "agent_id": AGENT_ID,
        "task_type": "zillow_search",
        "status": "queued",
        "input_params": {"intent_profile": INTENT_PROFILE},
    }).execute()
    print("Created agent_tasks row in Supabase.")

    # Build one shared browser for the entire run
    browser = build_browser_session(keep_alive=True)

    agent = ZillowSearchAgent(
        task_id=task_id,
        agent_id=AGENT_ID,
        buyer_id=None,
        browser=browser,
    )

    print("Starting Zillow search...\n")
    try:
        property_ids = await agent.run({"intent_profile": INTENT_PROFILE})
    finally:
        await browser.stop()

    print(f"\n{'='*60}")
    print(f"DONE — {len(property_ids)} properties saved")
    for pid in property_ids:
        print(f"  {pid}")

    # Print execution log summary
    print(f"\nExecution log ({len(agent.execution_log)} events):")
    for event in agent.execution_log:
        print(f"  [{event['timestamp']}] {event['action']}")


if __name__ == "__main__":
    asyncio.run(main())
