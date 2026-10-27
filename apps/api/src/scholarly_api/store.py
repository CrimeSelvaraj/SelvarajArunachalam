from __future__ import annotations

import asyncio
from typing import Dict

from scholarly_api.models import JobRecord


class JobStore:
    """In-memory job store for the Phase 2 stub (swap for SQLite/Postgres later)."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}
        self._lock = asyncio.Lock()

    async def put(self, job: JobRecord) -> JobRecord:
        async with self._lock:
            self._jobs[job.id] = job
            return job

    async def get(self, job_id: str) -> JobRecord | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def update(self, job: JobRecord) -> JobRecord:
        async with self._lock:
            self._jobs[job.id] = job
            return job


store = JobStore()
