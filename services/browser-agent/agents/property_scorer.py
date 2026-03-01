"""LLM property scoring — runs after enrichment to score each property against
the buyer's intent profile.

Uses Cerebras (fast, free) by default. Falls back to Gemini if Cerebras key
is not set. All properties are scored in a single batched call to minimize
API usage.
"""

import json
from openai import OpenAI
from db.supabase_client import supabase
from config import CEREBRAS_API_KEY, GEMINI_API_KEY

BATCH_SCORING_PROMPT = """You are a real estate property-buyer matching expert. You will receive a buyer's intent profile and MULTIPLE property listings. Score EACH property on how well it matches the buyer on a 0-100 scale.

Consider for each property:
- Price fit within budget (heavily weighted)
- Bedroom/bathroom match
- Location/area match
- School district quality vs buyer priorities
- Amenity match (pool, garage, smart home, etc.)
- Commute time vs buyer's tolerance
- HOA costs vs buyer's tolerance
- Property condition and age
- Lot size and type

Respond with a JSON array where each element has the property_id and its scores.
Respond with valid JSON only:
[
  {
    "property_id": "the property id from the input",
    "match_score": number,
    "score_reasoning": "2-3 sentence explanation for the buyer, highlighting positives and flagging concerns",
    "score_breakdown": {
      "price_fit": number,
      "bedrooms": number,
      "location": number,
      "schools": number,
      "amenities": number,
      "commute": number,
      "overall_value": number
    }
  }
]"""


def _build_property_block(prop: dict) -> str:
    """Build a single property's context block."""
    price = prop.get("listing_price")
    price_str = f"${price:,.0f}" if price else "N/A"
    sqft = prop.get("sqft")
    sqft_str = f"{sqft:,}" if sqft else "N/A"
    hoa = prop.get("hoa_monthly") or 0

    return f"""--- PROPERTY (id: {prop['id']}) ---
Address: {prop.get('address', 'N/A')}
Price: {price_str}
Beds: {prop.get('beds', 'N/A')}
Baths: {prop.get('baths', 'N/A')}
Sqft: {sqft_str}
Year Built: {prop.get('year_built', 'N/A')}
HOA: ${hoa}/month
Days on Market: {prop.get('days_on_market', 'N/A')}
Walk Score: {prop.get('walk_score', 'N/A')}
School Ratings: {json.dumps(prop.get('school_ratings'))}
Amenities: {json.dumps(prop.get('amenities'))}
Commute Data: {json.dumps(prop.get('commute_data'))}
Description: {prop.get('listing_description', 'N/A')}"""


def _build_batch_context(buyer_intent: dict, properties: list[dict]) -> str:
    """Build the full batch scoring context with buyer intent + all properties."""
    prop_blocks = "\n\n".join(_build_property_block(p) for p in properties)

    return f"""BUYER INTENT PROFILE:
{json.dumps(buyer_intent, indent=2)}

Score each of the following {len(properties)} properties:

{prop_blocks}"""


def _call_llm(context: str) -> list:
    """Call the LLM to score properties. Uses Cerebras if available, else Gemini."""
    if CEREBRAS_API_KEY:
        client = OpenAI(
            base_url="https://api.cerebras.ai/v1",
            api_key=CEREBRAS_API_KEY,
        )
        response = client.chat.completions.create(
            model="gpt-oss-120b",
            messages=[
                {"role": "system", "content": BATCH_SCORING_PROMPT},
                {"role": "user", "content": context},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=8192,
        )
        text = response.choices[0].message.content
    elif GEMINI_API_KEY:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=context,
            config=types.GenerateContentConfig(
                system_instruction=BATCH_SCORING_PROMPT,
                max_output_tokens=8192,
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
        text = response.text
    else:
        return []

    parsed = json.loads(text)
    # Cerebras json_object mode wraps in an object — unwrap if needed
    if isinstance(parsed, dict):
        # Try common wrapper keys
        for key in ("properties", "scores", "results", "value", "data"):
            if key in parsed and isinstance(parsed[key], list):
                parsed = parsed[key]
                break
    # If it's still a dict with property IDs as keys, convert to list
    if isinstance(parsed, dict):
        parsed = list(parsed.values()) if all(isinstance(v, dict) for v in parsed.values()) else [parsed]

    return parsed if isinstance(parsed, list) else []


def score_properties(buyer_id: str, property_ids: list[str]) -> list[dict]:
    """Score all properties for a buyer in a single batched LLM call.

    Returns list of score dicts that were successfully saved.
    """
    if not CEREBRAS_API_KEY and not GEMINI_API_KEY:
        return []

    # Fetch buyer intent profile
    buyer_result = supabase.table("buyers").select("intent_profile").eq("id", buyer_id).execute()
    if not buyer_result.data:
        return []
    buyer_intent = buyer_result.data[0].get("intent_profile") or {}
    if not buyer_intent:
        return []

    # Fetch properties
    props_result = supabase.table("properties").select("*").in_("id", property_ids).execute()
    if not props_result.data:
        return []

    properties = props_result.data
    context = _build_batch_context(buyer_intent, properties)

    # Single batched LLM call
    try:
        results = _call_llm(context)
    except Exception as e:
        print(f"[scorer] LLM call failed: {e}")
        return []

    if not results:
        print("[scorer] No results from LLM")
        return []

    # Persist each score
    scores = []
    for result in results:
        try:
            prop_id = result.get("property_id")
            match_score = result.get("match_score")
            if not prop_id or not isinstance(match_score, (int, float)):
                continue

            supabase.table("buyer_property_scores").upsert(
                {
                    "buyer_id": buyer_id,
                    "property_id": prop_id,
                    "match_score": match_score,
                    "score_reasoning": result.get("score_reasoning", ""),
                    "score_breakdown": result.get("score_breakdown"),
                },
                on_conflict="buyer_id,property_id",
            ).execute()

            scores.append({
                "property_id": prop_id,
                "match_score": match_score,
                "score_reasoning": result.get("score_reasoning", ""),
            })
        except Exception as e:
            print(f"[scorer] Failed to persist score for {result.get('property_id')}: {e}")
            continue

    return scores
