"""End-to-end test for the property scoring pipeline."""
import json
from db.supabase_client import supabase
from agents.property_scorer import score_properties

def check_data():
    """Check what test data exists in the database."""
    print("=== BUYERS ===")
    buyers = supabase.table("buyers").select("id, full_name, intent_profile").limit(5).execute()
    buyer_with_intent = None
    for b in buyers.data:
        ip = b.get("intent_profile")
        has_intent = bool(ip) and ip != {}
        print(f"  {b['id'][:8]}... | {b.get('full_name', 'N/A')} | has_intent: {has_intent}")
        if has_intent:
            print(f"    intent keys: {list(ip.keys())}")
            if buyer_with_intent is None:
                buyer_with_intent = b

    print()
    print("=== PROPERTIES ===")
    props = supabase.table("properties").select("id, address, listing_price, beds, baths, sqft, walk_score").limit(5).execute()
    for p in props.data:
        print(f"  {p['id'][:8]}... | {p.get('address', 'N/A')} | ${p.get('listing_price', 'N/A')} | {p.get('beds')}bd/{p.get('baths')}ba | walk:{p.get('walk_score')}")

    print()
    print("=== EXISTING SCORES ===")
    scores = supabase.table("buyer_property_scores").select("buyer_id, property_id, match_score, score_reasoning").limit(10).execute()
    print(f"  Total: {len(scores.data)}")
    for s in scores.data:
        reasoning = str(s.get("score_reasoning", ""))[:80]
        print(f"  buyer={s['buyer_id'][:8]}... prop={s['property_id'][:8]}... score={s['match_score']} | {reasoning}")

    return buyer_with_intent, [p["id"] for p in props.data]


def test_scoring(buyer_id, property_ids):
    """Run the actual scoring pipeline."""
    print()
    print("=" * 60)
    print(f"TESTING: score_properties(buyer={buyer_id[:8]}..., {len(property_ids)} properties)")
    print("=" * 60)

    results = score_properties(buyer_id, property_ids)

    print(f"\nScored {len(results)} / {len(property_ids)} properties")
    for r in results:
        print(f"\n  Property: {r['property_id'][:8]}...")
        print(f"  Score:    {r['match_score']}")
        print(f"  Reason:   {r['score_reasoning']}")

    # Verify scores were persisted
    print("\n=== VERIFYING DB PERSISTENCE ===")
    for r in results:
        row = (
            supabase.table("buyer_property_scores")
            .select("match_score, score_reasoning, score_breakdown")
            .eq("buyer_id", buyer_id)
            .eq("property_id", r["property_id"])
            .single()
            .execute()
        )
        d = row.data
        print(f"  {r['property_id'][:8]}... -> DB score={d['match_score']}, has_reasoning={bool(d.get('score_reasoning'))}, has_breakdown={bool(d.get('score_breakdown'))}")

    return results


if __name__ == "__main__":
    buyer, prop_ids = check_data()

    if not buyer:
        print("\nNo buyer with intent_profile found. Cannot test scoring.")
    elif not prop_ids:
        print("\nNo properties found. Cannot test scoring.")
    else:
        # Test with up to 2 properties to keep it fast
        test_ids = prop_ids[:2]
        test_scoring(buyer["id"], test_ids)

    print("\nDone.")
