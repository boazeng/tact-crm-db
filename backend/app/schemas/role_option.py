"""Schemas for per-company role (תפקיד) options."""
from pydantic import BaseModel, ConfigDict


class RoleOptionIn(BaseModel):
    label: str
    sort_order: int = 0
    is_active: bool = True


class RoleOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    label: str
    sort_order: int
    is_active: bool
