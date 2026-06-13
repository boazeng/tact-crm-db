"""Schemas for per-company yes/no flag display names (flag1..flag3)."""
from pydantic import BaseModel


class FlagLabelOut(BaseModel):
    flag_index: int    # 1-based flag (1 → flag1 ... 5 → flag5)
    label: str         # the resolved label (custom, or the default `דגל N`)
    is_active: bool = True


class FlagLabelIn(BaseModel):
    flag_index: int
    label: str = ""    # empty / default → the flag falls back to `דגל N`
    is_active: bool = True


class FlagLabelsUpdate(BaseModel):
    """Bulk replace: the full set of flags the company wants to set."""
    labels: list[FlagLabelIn] = []
