import asyncio
import json
from datetime import datetime
from typing import Any
from db.supabase_client import supabase


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
        """Save a property to the database and return its ID."""
        property_data["agent_id"] = self.agent_id
        property_data["research_task_id"] = self.task_id
        property_data["scraped_at"] = datetime.utcnow().isoformat()

        result = supabase.table("properties").insert(property_data).execute()
        return result.data[0]["id"]

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
