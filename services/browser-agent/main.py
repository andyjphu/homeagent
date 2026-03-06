from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models.tasks import TaskRequest, TaskResponse, TaskStatus
from agents.zillow_search import ZillowSearchAgent
from agents.full_pipeline import FullResearchPipeline
from agents.school_search import SchoolAgent
from agents.walkscore_search import WalkScoreAgent
from agents.commute_search import CommuteAgent
from task_queue.manager import queue_manager

app = FastAPI(title="FoyerFind Browser Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AGENT_CLASSES = {
    "zillow_search": ZillowSearchAgent,
    "property_detail": ZillowSearchAgent,
    "cross_reference": FullResearchPipeline,  # cross_reference runs school+walkscore+commute
    "full_research_pipeline": FullResearchPipeline,
}


@app.post("/tasks", response_model=TaskResponse)
async def create_task(request: TaskRequest):
    agent_class = AGENT_CLASSES.get(request.task_type.value)
    if not agent_class:
        raise HTTPException(400, f"Unknown task type: {request.task_type}")

    agent = agent_class(
        task_id=request.task_id,
        agent_id=request.agent_id,
        buyer_id=request.buyer_id,
    )

    await queue_manager.enqueue(
        request.task_id,
        agent.run(request.input_params),
    )

    return TaskResponse(
        task_id=request.task_id,
        status=TaskStatus.queued,
        message="Task queued for processing",
    )


@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    status = queue_manager.get_status(task_id)
    return {"task_id": task_id, "queue_status": status}


@app.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    cancelled = queue_manager.cancel(task_id)
    return {"task_id": task_id, "cancelled": cancelled}


@app.get("/tasks")
async def list_tasks():
    return queue_manager.stats


@app.get("/health")
async def health():
    return {"status": "healthy", **queue_manager.stats}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
