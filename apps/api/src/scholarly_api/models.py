from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class JobStage(str, Enum):
    queued = "queued"
    search = "search"
    screen = "screen"
    read = "read"
    draft = "draft"
    cite = "cite"
    complete = "complete"
    failed = "failed"


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobOptions(BaseModel):
    depth: str = Field(
        default="quick",
        description="quick | deep — ignored by stub, accepted for forward compatibility",
    )
    include_github: bool = True
    citation_style: str = Field(default="apa", description="apa | nature | news")


class CreateJobRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500)
    options: JobOptions = Field(default_factory=JobOptions)


class JobEvent(BaseModel):
    stage: JobStage
    message: str
    at: datetime
    meta: dict[str, Any] = Field(default_factory=dict)


class JobRecord(BaseModel):
    id: str
    topic: str
    options: JobOptions
    status: JobStatus
    stage: JobStage
    progress: float = Field(ge=0.0, le=1.0)
    events: list[JobEvent] = Field(default_factory=list)
    article_id: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
