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
        description="quick | deep — controls OpenAlex result count and screen cap",
    )
    include_github: bool = True
    citation_style: str = Field(default="apa", description="apa | nature | news")
    screen_max: int | None = Field(
        default=None,
        ge=4,
        le=40,
        description="Cap on sources included for deep read (default: 12 quick / 18 deep)",
    )


class ScreenDecision(str, Enum):
    include = "include"
    exclude = "exclude"
    duplicate = "duplicate"


class ScreeningSummary(BaseModel):
    method: str = Field(
        default="heuristic",
        description="heuristic | llm:<model> — ranking method used",
    )
    max_include: int = 12
    included_count: int = 0
    excluded_count: int = 0
    duplicate_count: int = 0
    candidate_count: int = 0


class CreateJobRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500)
    options: JobOptions = Field(default_factory=JobOptions)


class JobEvent(BaseModel):
    stage: JobStage
    message: str
    at: datetime
    meta: dict[str, Any] = Field(default_factory=dict)


class SourceWork(BaseModel):
    """Discovery candidate — OpenAlex work (`work`) or GitHub repo (`software`)."""

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
    source_type: str = Field(
        default="work",
        description="work | software",
    )
    # GitHub / software fields (Phase 4)
    github_full_name: str | None = None
    html_url: str | None = None
    stars: int | None = None
    license_spdx: str | None = None
    readme_snippet: str | None = None
    citation_cff: str | None = None
    # Screening (Phase 5 — ASReview-inspired)
    relevance_score: float | None = None
    screen_decision: ScreenDecision | None = None
    screen_rationale: str | None = None
    duplicate_of: str | None = None


class JobRecord(BaseModel):
    id: str
    topic: str
    options: JobOptions
    status: JobStatus
    stage: JobStage
    progress: float = Field(ge=0.0, le=1.0)
    events: list[JobEvent] = Field(default_factory=list)
    sources: list[SourceWork] = Field(default_factory=list)
    screening: ScreeningSummary | None = None
    article_id: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
