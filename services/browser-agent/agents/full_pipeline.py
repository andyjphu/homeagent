from agents.base import BaseResearchAgent, build_browser_session
from agents.zillow_search import ZillowSearchAgent
from agents.school_search import SchoolAgent
from agents.walkscore_search import WalkScoreAgent
from agents.commute_search import CommuteAgent
from db.supabase_client import supabase


class FullResearchPipeline(BaseResearchAgent):
    """Orchestrates the full research flow: Zillow search -> cross-reference enrichment.

    Creates a single shared browser session and passes it to every sub-agent
    so they all reuse the same stealth browser instance.
    """

    async def run(self, input_params: dict) -> list[str]:
        await self.update_status("running")
        self.log_event("pipeline_start", input_params)

        intent = input_params.get("intent_profile", {})
        workplace = intent.get("workplace_address")

        await self.create_activity(
            "research_started",
            "Full research pipeline started",
            description="Running Zillow search + school/walkscore/commute enrichment",
        )

        # Create one browser session for the entire pipeline
        shared_browser = build_browser_session(keep_alive=True)

        try:
            property_ids = await self._run_pipeline(
                input_params, intent, workplace, shared_browser,
            )
        finally:
            # Always close the browser when the pipeline is done
            try:
                await shared_browser.stop()
            except Exception:
                pass

        return property_ids

    async def _run_pipeline(
        self, input_params: dict, intent: dict, workplace: str | None, shared_browser,
    ) -> list[str]:
        # ------------------------------------------------------------------
        # Stage 1+2: Zillow search + detail extraction
        # ------------------------------------------------------------------
        self.log_event("stage_zillow_start")
        zillow_agent = ZillowSearchAgent(
            self.task_id, self.agent_id, self.buyer_id, browser=shared_browser,
        )
        try:
            property_ids = await zillow_agent.run(input_params)
        except Exception as e:
            self.log_event("stage_zillow_failed", {"error": str(e)})
            await self.update_status("failed", error=f"Zillow search failed: {e}")
            await self.save_log()
            raise

        if not property_ids:
            self.log_event("no_properties_found")
            await self.update_status("completed", output_data={
                "properties_found": 0,
                "properties_enriched": 0,
                "property_ids": [],
            })
            await self.save_log()
            return []

        self.log_event("stage_zillow_done", {"property_count": len(property_ids)})
        self.execution_log.extend(zillow_agent.execution_log)

        # ------------------------------------------------------------------
        # Stage 3: Cross-reference enrichment for each property
        # ------------------------------------------------------------------
        self.log_event("stage_crossref_start", {"property_count": len(property_ids)})

        enriched_count = 0

        for i, prop_id in enumerate(property_ids, 1):
            # Fetch property data from DB
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

        # ------------------------------------------------------------------
        # Complete
        # ------------------------------------------------------------------
        self.log_event("pipeline_complete", {
            "property_ids": property_ids,
            "enriched": enriched_count,
        })

        await self.update_status(
            "completed",
            output_data={
                "properties_found": len(property_ids),
                "properties_enriched": enriched_count,
                "property_ids": property_ids,
            },
        )

        await self.create_activity(
            "research_completed",
            f"Full research complete: {len(property_ids)} properties, {enriched_count} enriched",
            description=(
                f"Zillow search found {len(property_ids)} properties. "
                f"Cross-referenced {enriched_count} with school ratings, walk scores, and commute data."
            ),
            metadata={
                "property_count": len(property_ids),
                "enriched_count": enriched_count,
                "property_ids": property_ids,
            },
        )

        await self.save_log()
        return property_ids

    def _build_full_address(self, prop: dict) -> str:
        parts = [prop.get("address", "")]
        if prop.get("city"):
            parts.append(prop["city"])
        if prop.get("state"):
            parts.append(prop["state"])
        if prop.get("zip"):
            parts.append(prop["zip"])
        return ", ".join(p for p in parts if p)
