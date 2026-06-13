"""Schemas for projects (core basic data + configurable params/numbers/flags/lists)."""
from datetime import datetime, date

from pydantic import BaseModel, ConfigDict


class ProjectIn(BaseModel):
    """Create/update payload."""

    # basic data
    project_number: str | None = None
    name: str
    description: str | None = None
    customer_membership_id: int | None = None
    notes: str | None = None
    creation_date: date | None = None   # editable; server defaults to today on create

    # configurable fields (fixed counts; labels resolved client-side)
    params: list[str | None] = []      # 10 text
    numbers: list[float | None] = []   # 5 numeric
    flags: list[bool] = []             # 5 yes/no
    lists: list[str | None] = []       # 10 single-choice


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    project_number: str | None
    name: str
    description: str | None
    customer_membership_id: int | None
    customer_name: str | None = None
    notes: str | None
    creation_date: date | None = None

    params: list[str | None] = []
    numbers: list[float | None] = []
    flags: list[bool] = []
    lists: list[str | None] = []

    created_at: datetime
    updated_at: datetime
