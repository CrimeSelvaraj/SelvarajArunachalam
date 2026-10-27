from __future__ import annotations

import asyncio
from typing import Dict

from scholarly_api.models import JobRecord


class JobStore:
    """In-memory job store (swap for SQLite/Postgres later)."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}
        self._order: list[str] = []
        self._lock = asyncio.Lock()

    async def put(self, job: JobRecord) -> JobRecord:
        async with self._lock:
            if job.id not in self._jobs:
                self._order.insert(0, job.id)
            self._jobs[job.id] = job
            return job

    async def get(self, job_id: str) -> JobRecord | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def update(self, job: JobRecord) -> JobRecord:
        async with self._lock:
            self._jobs[job.id] = job
            return job

    async def list_recent(self, limit: int = 20) -> list[JobRecord]:
        async with self._lock:
            ids = self._order[: max(0, limit)]
            return [self._jobs[i] for i in ids if i in self._jobs]


store = JobStore()
