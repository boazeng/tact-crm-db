"""Schemas for per-company API keys."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ApiKeyIn(BaseModel):
    label: str


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    label: str
    key_prefix: str
    is_active: bool
    last_used_at: datetime | None
    created_at: datetime


class ApiKeyCreated(ApiKeyOut):
    """Returned ONCE on creation — includes the raw secret."""

    raw_key: str
