import asyncio
from collections import deque
from typing import Callable, Any
from config import MAX_CONCURRENT_TASKS


class TaskQueueManager:
    """Manages concurrent Browser Use agent tasks."""

    def __init__(self):
        self.max_concurrent = MAX_CONCURRENT_TASKS
        self.queue: deque = deque()
        self.running: dict[str, asyncio.Task] = {}
        self.semaphore = asyncio.Semaphore(self.max_concurrent)

    async def enqueue(self, task_id: str, coro):
        """Add a task to the queue and start processing."""
        self.queue.append((task_id, coro))
        asyncio.create_task(self._process_next())

    async def _process_next(self):
        async with self.semaphore:
            if not self.queue:
                return

            task_id, coro = self.queue.popleft()
            task = asyncio.create_task(coro)
            self.running[task_id] = task

            try:
                await task
            except Exception as e:
                print(f"Task {task_id} failed: {e}")
            finally:
                self.running.pop(task_id, None)

    def get_status(self, task_id: str) -> str:
        if task_id in self.running:
            return "running"
        for tid, _ in self.queue:
            if tid == task_id:
                return "queued"
        return "unknown"

    def cancel(self, task_id: str) -> bool:
        if task_id in self.running:
            self.running[task_id].cancel()
            return True
        # Remove from queue
        self.queue = deque((tid, c) for tid, c in self.queue if tid != task_id)
        return False

    @property
    def stats(self) -> dict:
        return {
            "queued": len(self.queue),
            "running": len(self.running),
            "max_concurrent": self.max_concurrent,
        }


# Global instance
queue_manager = TaskQueueManager()
