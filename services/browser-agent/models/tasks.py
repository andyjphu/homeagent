from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


class TaskType(str, Enum):
    zillow_search = "zillow_search"
    property_detail = "property_detail"
    cross_reference = "cross_reference"
    comp_analysis = "comp_analysis"
    listing_monitor = "listing_monitor"
    listing_agent_profile = "listing_agent_profile"
    full_research_pipeline = "full_research_pipeline"


class TaskStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class TaskRequest(BaseModel):
    task_id: str
    agent_id: str
    buyer_id: Optional[str] = None
    task_type: TaskType
    input_params: dict = {}


class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus
    message: str = ""


class PropertyData(BaseModel):
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    listing_price: Optional[int] = None
    beds: Optional[int] = None
    baths: Optional[float] = None
    sqft: Optional[int] = None
    lot_sqft: Optional[int] = None
    year_built: Optional[int] = None
    property_type: Optional[str] = None
    hoa_monthly: Optional[int] = None
    listing_description: Optional[str] = None
    photos: list[str] = []
    amenities: list[str] = []
    days_on_market: Optional[int] = None
    listing_status: str = "active"
    zillow_url: Optional[str] = None
    zillow_id: Optional[str] = None
    price_history: list[dict] = []
