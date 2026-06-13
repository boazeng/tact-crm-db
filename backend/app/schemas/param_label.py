"""Schemas for per-company parameter display names (param1..param10)."""
from pydantic import BaseModel


class ParamLabelOut(BaseModel):
    param_index: int   # 1-based slot (1 → param1 ... 15 → param15)
    label: str         # the resolved label (custom, or the default `פרמטר N`)
    is_active: bool = True


class ParamLabelIn(BaseModel):
    param_index: int
    label: str = ""    # empty / default → the slot falls back to `פרמטר N`
    is_active: bool = True


class ParamLabelsUpdate(BaseModel):
    """Bulk replace: the full set of slots the company wants to set."""
    labels: list[ParamLabelIn] = []
