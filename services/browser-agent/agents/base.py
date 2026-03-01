import asyncio
import json
import os
from datetime import datetime
from typing import Any
from browser_use.llm.google.chat import ChatGoogle
from browser_use.browser.session import BrowserSession
from db.supabase_client import supabase
from config import GEMINI_API_KEY

REALISTIC_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# Persistent profile dir so cookies/state carry over between runs
_PROFILE_DIR = os.path.join(os.path.dirname(__file__), "..", ".browser_profile")


def build_llm() -> ChatGoogle:
    """Build a Gemini LLM instance using browser-use's native ChatGoogle wrapper."""
    return ChatGoogle(
        model=os.getenv("BROWSER_USE_MODEL", "gemini-2.5-flash-lite"),
        api_key=GEMINI_API_KEY,
    )


def build_browser_session() -> BrowserSession:
    """Build a stealth browser session with anti-detection measures."""
    os.makedirs(_PROFILE_DIR, exist_ok=True)
    return BrowserSession(
        headless=False,
        user_agent=REALISTIC_USER_AGENT,
        disable_security=True,
        user_data_dir=_PROFILE_DIR,
        enable_default_extensions=True,
        wait_between_actions=1.5,
        minimum_wait_page_load_time=2.0,
        wait_for_network_idle_page_load_time=3.0,
    )


class BaseResearchAgent:
    """Base class for all Browser Use research agents."""

    def __init__(self, task_id: str, agent_id: str, buyer_id: str | None = None):
        self.task_id = task_id
        self.agent_id = agent_id
        self.buyer_id = buyer_id
        self.execution_log: list[dict] = []

    async def update_status(self, status: str, **kwargs):
        update = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
        }
        if status == "running":
            update["started_at"] = datetime.utcnow().isoformat()
        elif status == "completed":
            update["completed_at"] = datetime.utcnow().isoformat()
        elif status == "failed":
            update["failed_at"] = datetime.utcnow().isoformat()
            if "error" in kwargs:
                update["error_message"] = kwargs["error"]

        update.update(kwargs)
        supabase.table("agent_tasks").update(update).eq("id", self.task_id).execute()

    def log_event(self, action: str, data: Any = None):
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "data": data,
        }
        self.execution_log.append(event)

    async def save_log(self):
        supabase.table("agent_tasks").update(
            {"execution_log": self.execution_log}
        ).eq("id", self.task_id).execute()

    async def save_property(self, property_data: dict) -> str:
        """Save or update a property in the database. Upserts on zillow_url to avoid duplicates."""
        property_data["agent_id"] = self.agent_id
        property_data["research_task_id"] = self.task_id
        property_data["scraped_at"] = datetime.utcnow().isoformat()

        if property_data.get("zillow_url"):
            result = supabase.table("properties").upsert(
                property_data, on_conflict="zillow_url"
            ).execute()
        else:
            result = supabase.table("properties").insert(property_data).execute()
        return result.data[0]["id"]

    async def save_listing_agent(self, agent_data: dict) -> str:
        """Save a listing agent, deduplicating by name + brokerage."""
        existing = (
            supabase.table("listing_agents")
            .select("id")
            .eq("name", agent_data["name"])
            .eq("brokerage", agent_data.get("brokerage", ""))
            .execute()
        )
        if existing.data:
            return existing.data[0]["id"]
        result = supabase.table("listing_agents").insert(agent_data).execute()
        return result.data[0]["id"]

    async def link_property_to_buyer(self, buyer_id: str, property_id: str):
        """Create a buyer_property_scores junction record (score=0 placeholder)."""
        supabase.table("buyer_property_scores").upsert(
            {
                "buyer_id": buyer_id,
                "property_id": property_id,
                "match_score": 0,
            },
            on_conflict="buyer_id,property_id",
        ).execute()

    async def create_activity(self, event_type: str, title: str, **kwargs):
        entry = {
            "agent_id": self.agent_id,
            "event_type": event_type,
            "title": title,
            "task_id": self.task_id,
        }
        if self.buyer_id:
            entry["buyer_id"] = self.buyer_id
        entry.update(kwargs)
        supabase.table("activity_feed").insert(entry).execute()

    async def run(self, input_params: dict):
        raise NotImplementedError
