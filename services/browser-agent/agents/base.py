import asyncio
import json
import os
import re
from datetime import datetime
from typing import Any
from browser_use import Agent, Browser, ChatGoogle, ChatBrowserUse, BrowserProfile
from db.supabase_client import supabase
from config import GEMINI_API_KEY

REALISTIC_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# Persistent profile dir so cookies/state carry over between runs
_PROFILE_DIR = os.path.join(os.path.dirname(__file__), "..", ".browser_profile")

# Chromium args that reduce automation fingerprint
STEALTH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=AutomationControlled",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-ipc-flooding-protection",
    "--password-store=basic",
    "--use-mock-keychain",
]

BROWSER_USE_API_KEY = os.getenv("BROWSER_USE_API_KEY", "")


def build_llm():
    """Build an LLM instance for browser-use agents.

    Uses Browser Use Cloud LLM when BROWSER_USE_API_KEY is set (recommended —
    no rate limits, optimized for browser tasks).
    Falls back to Gemini ChatGoogle otherwise.
    """
    if BROWSER_USE_API_KEY:
        return ChatBrowserUse(api_key=BROWSER_USE_API_KEY)
    return ChatGoogle(
        model=os.getenv("BROWSER_USE_MODEL", "gemini-2.0-flash"),
        api_key=GEMINI_API_KEY,
    )


def build_browser_session(keep_alive: bool = True) -> Browser:
    """Build a browser session for research agents.

    When BROWSER_USE_API_KEY is set, uses Browser Use Cloud which provides:
    - Stealth browser fingerprinting (bypasses bot detection)
    - Automatic CAPTCHA solving
    - Proxy rotation

    Falls back to a local stealth Chromium session otherwise.

    Args:
        keep_alive: If True, the browser stays open after an agent run completes.
    """
    if BROWSER_USE_API_KEY:
        # Cloud browser — stealth + CAPTCHA solving handled by the service
        return Browser(
            use_cloud=True,
            keep_alive=keep_alive,
            captcha_solver=True,
            wait_between_actions=1.0,
            minimum_wait_page_load_time=1.5,
            wait_for_network_idle_page_load_time=2.5,
        )

    # Local browser — use stealth args and persistent profile
    os.makedirs(_PROFILE_DIR, exist_ok=True)
    return Browser(
        headless=False,
        user_agent=REALISTIC_USER_AGENT,
        disable_security=True,
        user_data_dir=_PROFILE_DIR,
        enable_default_extensions=True,
        keep_alive=keep_alive,
        captcha_solver=True,
        args=STEALTH_ARGS,
        wait_between_actions=1.0,
        minimum_wait_page_load_time=1.5,
        wait_for_network_idle_page_load_time=2.5,
    )


class BaseResearchAgent:
    """Base class for all Browser Use research agents."""

    def __init__(
        self,
        task_id: str,
        agent_id: str,
        buyer_id: str | None = None,
        browser: Browser | None = None,
    ):
        self.task_id = task_id
        self.agent_id = agent_id
        self.buyer_id = buyer_id
        self.browser = browser
        self.execution_log: list[dict] = []

    async def ensure_browser(self) -> Browser:
        """Return the shared browser, creating one if needed."""
        if self.browser is None:
            self.browser = build_browser_session(keep_alive=True)
        return self.browser

    async def close_browser(self):
        """Shut down the browser session if we own it."""
        if self.browser is not None:
            try:
                await self.browser.stop()
            except Exception:
                pass
            self.browser = None

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
        """Save or update a property in the database. Deduplicates on address + agent_id."""
        property_data["agent_id"] = self.agent_id
        property_data["research_task_id"] = self.task_id
        property_data["scraped_at"] = datetime.utcnow().isoformat()

        # Check for existing property by address + agent_id to avoid duplicates
        address = property_data.get("address")
        if address:
            existing = (
                supabase.table("properties")
                .select("id")
                .eq("address", address)
                .eq("agent_id", self.agent_id)
                .execute()
            )
            if existing.data:
                prop_id = existing.data[0]["id"]
                supabase.table("properties").update(property_data).eq("id", prop_id).execute()
                return prop_id

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

    def extract_result(self, result) -> str | None:
        """Extract text content from an AgentHistoryList result.

        Prefers final_result() (the clean output from the agent's done action).
        Falls back to extracted_content() only when final_result is empty.
        Merging both caused parse failures because extracted_content includes
        intermediate page text that corrupts JSON parsing.
        """
        if hasattr(result, "final_result"):
            text = result.final_result()
            if text:
                return text
        if hasattr(result, "extracted_content"):
            contents = result.extracted_content()
            if contents:
                return "\n".join(contents)
        return str(result) if result else None

    def parse_json(self, raw: str | None):
        """Extract JSON array or object from browser-use output.

        Handles:
        - Escaped quotes from browser-use done action (\\\" -> \")
        - Markdown code fences
        - JSON embedded in surrounding text
        """
        if not raw:
            return None
        text = str(raw)

        # Strip markdown code fences
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*", "", text)

        # Unescape \" -> " (browser-use 0.12 done action escaping)
        if '\\"' in text:
            text = text.replace('\\"', '"')

        text = text.strip()

        # Direct parse
        if text.startswith("[") or text.startswith("{"):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass

        # Extract JSON array from surrounding text
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        # Extract JSON object from surrounding text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        return None

    async def run(self, input_params: dict):
        raise NotImplementedError
