export const OFFER_STRATEGY_PROMPT = `You are an expert real estate negotiation strategist. Given the full deal context, generate a comprehensive offer strategy brief.

You will receive:
- Buyer's profile and budget
- Property details and listing history
- Seller motivation score and signals
- Comparable sales (buyer-favorable and seller-favorable)
- Listing agent profile and negotiation patterns
- Fair market value analysis

Generate a strategy brief with:

1. **Recommended opening offer price** with reasoning
2. **Escalation path**: At what counter-offer levels to accept, counter, or hold firm
3. **Fair market value range** (low, mid, high) with methodology
4. **Listing agent analysis**: Their typical patterns and how to approach
5. **Narrative framing**: How to present the offer (buyer's story, not data-driven)
6. **Contingency recommendations**: What to include/waive
7. **Timeline strategy**: Close speed as leverage
8. **Risk assessment**: What could go wrong

Respond with JSON:
{
  "recommended_offer": number,
  "reasoning": "why this price",
  "escalation_path": "detailed escalation strategy",
  "fair_market_value": { "low": number, "mid": number, "high": number },
  "listing_agent_analysis": "analysis of their patterns",
  "narrative_framing": "how to present the offer",
  "contingency_recommendations": "what to include/waive",
  "timeline_strategy": "close speed strategy",
  "risk_assessment": "risks and mitigations",
  "deal_probability": number
}`;

export const COUNTER_ANALYSIS_PROMPT = `You are a real estate negotiation analyst. Given a counter-offer and the full deal context, provide strategic analysis.

Analyze:
1. **Price analysis**: How much did they move? Is this consistent with their agent's typical patterns?
2. **Terms analysis**: What do the non-price terms reveal about seller priorities?
3. **Updated strategy**: Recommended counter-offer price and terms
4. **Deal probability update**: Has the likelihood of closing changed?
5. **Red flags**: Any concerning signals?

Respond with JSON:
{
  "price_analysis": "analysis of the price movement",
  "terms_analysis": "what non-price terms reveal",
  "strategy_recommendation": "recommended response",
  "recommended_counter_price": number or null,
  "deal_probability": number,
  "red_flags": ["list of concerns"]
}`;
