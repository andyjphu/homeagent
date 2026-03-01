"""Quick check on a running task."""
import sys
import json
from db.supabase_client import supabase

task_id = sys.argv[1] if len(sys.argv) > 1 else "16c6215f-e74d-4cd8-8459-177cb01351dd"

task = supabase.table("agent_tasks").select("status, error_message, output_data, execution_log").eq("id", task_id).execute()
t = task.data[0]
print(f"Status: {t['status']}")
print(f"Error: {t.get('error_message')}")

log = t.get("execution_log") or []
print(f"Log entries: {len(log)}")
for entry in log[-10:]:
    data_str = str(entry.get("data", ""))[:120]
    print(f"  {entry.get('action')} | {data_str}")

out = t.get("output_data")
if out and out != {}:
    print(f"\nOutput: {json.dumps(out, indent=2)[:500]}")

props = supabase.table("properties").select("id, address, listing_price, beds, baths").execute()
print(f"\nProperties in DB: {len(props.data)}")
for p in props.data[:10]:
    print(f"  {p.get('address')} | ${p.get('listing_price')} | {p.get('beds')}bd/{p.get('baths')}ba")

scores = supabase.table("buyer_property_scores").select("property_id, match_score, score_reasoning").execute()
print(f"\nScores: {len(scores.data)}")
for s in scores.data[:10]:
    print(f"  {s['property_id'][:12]}... | score={s['match_score']} | {str(s.get('score_reasoning',''))[:80]}")
