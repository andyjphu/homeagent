"""Trigger a full research pipeline for the existing buyer and monitor progress."""
import asyncio
import uuid
import json
import time
from db.supabase_client import supabase
from agents.full_pipeline import FullResearchPipeline
from agents.base import build_browser_session

# Use the existing buyer (Sarah Chen) and agent (Andy Phu)
AGENT_ID = "871a3414-d550-403b-9b33-7714197a8f0f"

# Look up Sarah Chen (the buyer with real Fremont intent)
buyers = supabase.table("buyers").select("id, full_name, intent_profile").execute()
buyer = None
for b in buyers.data:
    ip = b.get("intent_profile")
    if ip and ip != {} and "Fremont" in str(ip.get("preferred_areas", [])):
        buyer = b
        break
if not buyer:
    # Fallback to any buyer with intent
    for b in buyers.data:
        ip = b.get("intent_profile")
        if ip and ip != {}:
            buyer = b
            break

if not buyer:
    print("No buyer with intent_profile found!")
    exit(1)

BUYER_ID = buyer["id"]
INTENT_PROFILE = buyer["intent_profile"]

print(f"Buyer: {buyer['full_name']} ({BUYER_ID[:12]}...)")
print(f"Intent: {json.dumps(INTENT_PROFILE, indent=2)}")
print()


async def main():
    task_id = str(uuid.uuid4())
    print(f"Task ID: {task_id}")

    # Create task row
    supabase.table("agent_tasks").insert({
        "id": task_id,
        "agent_id": AGENT_ID,
        "task_type": "full_research_pipeline",
        "status": "queued",
        "input_params": {"intent_profile": INTENT_PROFILE},
    }).execute()
    print("Task created in Supabase.\n")

    pipeline = FullResearchPipeline(
        task_id=task_id,
        agent_id=AGENT_ID,
        buyer_id=BUYER_ID,
    )

    print("Starting pipeline...\n")
    start = time.time()
    try:
        property_ids = await pipeline.run({
            "intent_profile": INTENT_PROFILE,
            "skip_enrichment": True,
        })
    except Exception as e:
        print(f"\nPipeline FAILED: {e}")
        property_ids = []

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"DONE in {elapsed:.0f}s — {len(property_ids)} properties")

    for pid in property_ids:
        prop = supabase.table("properties").select("address, listing_price").eq("id", pid).execute()
        if prop.data:
            p = prop.data[0]
            print(f"  {p.get('address')} | ${p.get('listing_price')}")

    # Check scores
    scores = supabase.table("buyer_property_scores").select(
        "property_id, match_score"
    ).eq("buyer_id", BUYER_ID).neq("match_score", 0).execute()
    print(f"\nScored properties: {len(scores.data)}")
    for s in scores.data:
        print(f"  {s['property_id'][:12]}... | score={s['match_score']}")

    # Print execution log summary
    print(f"\nExecution log ({len(pipeline.execution_log)} events):")
    for event in pipeline.execution_log:
        data_str = str(event.get("data", ""))[:100]
        print(f"  [{event['timestamp'][-8:]}] {event['action']} | {data_str}")


if __name__ == "__main__":
    asyncio.run(main())
