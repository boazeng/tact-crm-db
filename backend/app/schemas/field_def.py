"""Schemas for per-company custom field (classification) definitions."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from ..models import FieldType, CHOICE_TYPES


class FieldDefinitionIn(BaseModel):
    key: str
    label: str
    field_type: str
    options: list[str] | None = None
    is_required: bool = False
    sort_order: int = 0
    is_active: bool = True

    @field_validator("field_type")
    @classmethod
    def _valid_type(cls, v: str) -> str:
        if v not in set(FieldType):
            raise ValueError(f"Unknown field_type '{v}'")
        return v

    @field_validator("options")
    @classmethod
    def _options_present_for_choices(cls, v, info):
        ftype = info.data.get("field_type")
        if ftype in CHOICE_TYPES and not v:
            raise ValueError("select/multiselect fields require a non-empty 'options' list")
        return v


class FieldDefinitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    key: str
    label: str
    field_type: str
    options: list[str] | None
    is_required: bool
    sort_order: int
    is_active: bool
    created_at: datetime
