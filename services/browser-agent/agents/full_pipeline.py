from agents.base import BaseResearchAgent, build_browser_session
from agents.school_search import SchoolAgent
from agents.walkscore_search import WalkScoreAgent
from agents.commute_search import CommuteAgent
from agents.property_scorer import score_properties
from db.supabase_client import supabase


class FullResearchPipeline(BaseResearchAgent):
    """Orchestrates enrichment + scoring for existing properties.

    Accepts property_ids in input_params. Does NOT search for new properties.
    Use enrichment service (lib/enrichment/) or RapidAPI aggregator instead
    of browser-based property search.

    Pipeline stages:
      1. Cross-reference enrichment (school ratings, walk scores, commute data)
      2. LLM property scoring against buyer intent profile
    """

    async def run(self, input_params: dict) -> list[str]:
        await self.update_status("running")
        self.log_event("pipeline_start", input_params)

        property_ids = input_params.get("property_ids", [])
        intent = input_params.get("intent_profile", {})
        workplace = intent.get("workplace_address")

        if not property_ids:
            self.log_event("no_properties_to_enrich")
            await self.update_status("completed", output_data={
                "properties_found": 0,
                "properties_enriched": 0,
                "properties_scored": 0,
                "property_ids": [],
            })
            await self.save_log()
            return []

        await self.create_activity(
            "research_started",
            f"Enrichment pipeline started for {len(property_ids)} properties",
            description=f"Running school/walkscore/commute enrichment + LLM scoring",
        )

        # Create one browser session for the entire pipeline
        shared_browser = build_browser_session(keep_alive=True)

        try:
            enriched_count = await self._run_enrichment(
                property_ids, workplace, shared_browser,
            )
        finally:
            try:
                await shared_browser.stop()
            except Exception:
                pass

        # ------------------------------------------------------------------
        # Stage 2: LLM property scoring
        # ------------------------------------------------------------------
        scored_count = 0
        if self.buyer_id and property_ids:
            self.log_event("stage_scoring_start", {"property_count": len(property_ids)})
            try:
                scored = score_properties(self.buyer_id, property_ids)
                scored_count = len(scored)
                self.log_event("stage_scoring_done", {
                    "scored": scored_count,
                    "scores": [
                        {"property_id": s["property_id"], "match_score": s["match_score"]}
                        for s in scored
                    ],
                })
            except Exception as e:
                self.log_event("stage_scoring_failed", {"error": str(e)})

        # ------------------------------------------------------------------
        # Complete
        # ------------------------------------------------------------------
        self.log_event("pipeline_complete", {
            "property_ids": property_ids,
            "enriched": enriched_count,
            "scored": scored_count,
        })

        await self.update_status(
            "completed",
            output_data={
                "properties_found": len(property_ids),
                "properties_enriched": enriched_count,
                "properties_scored": scored_count,
                "property_ids": property_ids,
            },
        )

        await self.create_activity(
            "research_completed",
            f"Enrichment complete: {len(property_ids)} properties, {enriched_count} enriched, {scored_count} scored",
            description=(
                f"Cross-referenced {enriched_count} properties with school ratings, walk scores, and commute data. "
                f"Scored {scored_count} properties against buyer preferences."
            ),
            metadata={
                "property_count": len(property_ids),
                "enriched_count": enriched_count,
                "scored_count": scored_count,
                "property_ids": property_ids,
            },
        )

        await self.save_log()
        return property_ids

    async def _run_enrichment(
        self, property_ids: list[str], workplace: str | None, shared_browser,
    ) -> int:
        """Run browser-based enrichment (schools, walkscore, commute) on properties."""
        enriched_count = 0
        self.log_event("stage_crossref_start", {"property_count": len(property_ids)})

        for i, prop_id in enumerate(property_ids, 1):
            prop_result = supabase.table("properties").select("*").eq("id", prop_id).execute()
            if not prop_result.data:
                self.log_event("property_not_found", {"property_id": prop_id})
                continue

            prop = prop_result.data[0]
            full_address = self._build_full_address(prop)
            self.log_event("crossref_start", {
                "index": i,
                "total": len(property_ids),
                "address": full_address,
            })

            updates: dict = {}

            # School ratings
            try:
                school_agent = SchoolAgent(
                    self.task_id, self.agent_id, self.buyer_id, browser=shared_browser,
                )
                school_data = await school_agent.run({"address": full_address})
                if school_data:
                    updates["school_ratings"] = school_data
                self.execution_log.extend(school_agent.execution_log)
            except Exception as e:
                self.log_event("school_failed", {"address": full_address, "error": str(e)})

            # Walk Score / Transit Score
            try:
                walkscore_agent = WalkScoreAgent(
                    self.task_id, self.agent_id, self.buyer_id, browser=shared_browser,
                )
                walkscore_data = await walkscore_agent.run({"address": full_address})
                if walkscore_data:
                    if walkscore_data.get("walk_score") is not None:
                        updates["walk_score"] = walkscore_data["walk_score"]
                    if walkscore_data.get("transit_score") is not None:
                        updates["transit_score"] = walkscore_data["transit_score"]
                self.execution_log.extend(walkscore_agent.execution_log)
            except Exception as e:
                self.log_event("walkscore_failed", {"address": full_address, "error": str(e)})

            # Commute data (only if buyer has a workplace)
            if workplace:
                try:
                    commute_agent = CommuteAgent(
                        self.task_id, self.agent_id, self.buyer_id, browser=shared_browser,
                    )
                    commute_data = await commute_agent.run({
                        "address": full_address,
                        "workplace": workplace,
                    })
                    if commute_data:
                        updates["commute_data"] = commute_data
                    self.execution_log.extend(commute_agent.execution_log)
                except Exception as e:
                    self.log_event("commute_failed", {"address": full_address, "error": str(e)})

            # Apply updates to property record
            if updates:
                try:
                    supabase.table("properties").update(updates).eq("id", prop_id).execute()
                    enriched_count += 1
                    self.log_event("property_enriched", {
                        "property_id": prop_id,
                        "fields_updated": list(updates.keys()),
                    })
                except Exception as e:
                    self.log_event("property_update_error", {
                        "property_id": prop_id, "error": str(e),
                    })
            else:
                self.log_event("property_no_enrichment", {"property_id": prop_id})

        return enriched_count

    def _build_full_address(self, prop: dict) -> str:
        parts = [prop.get("address", "")]
        if prop.get("city"):
            parts.append(prop["city"])
        if prop.get("state"):
            parts.append(prop["state"])
        if prop.get("zip"):
            parts.append(prop["zip"])
        return ", ".join(p for p in parts if p)
