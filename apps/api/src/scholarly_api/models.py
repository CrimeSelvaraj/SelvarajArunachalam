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
        description="quick | deep — controls OpenAlex result count in Phase 3",
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


class SourceWork(BaseModel):
    """OpenAlex work candidate persisted on the job after discovery."""

    openalex_id: str
    doi: str | None = None
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    abstract_snippet: str | None = None
    is_oa: bool = False
    oa_status: str | None = None
    oa_url: str | None = None
    pdf_url: str | None = None
    landing_url: str | None = None
    cited_by_count: int | None = None
    source_type: str = "work"


class JobRecord(BaseModel):
    id: str
    topic: str
    options: JobOptions
    status: JobStatus
    stage: JobStage
    progress: float = Field(ge=0.0, le=1.0)
    events: list[JobEvent] = Field(default_factory=list)
    sources: list[SourceWork] = Field(default_factory=list)
    article_id: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
