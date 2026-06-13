"""Schemas for per-company customer numeric-param display names (num1..num15)."""
from pydantic import BaseModel


class NumberLabelOut(BaseModel):
    num_index: int     # 1-based slot (1 → num1 ... 15 → num15)
    label: str         # the resolved label (custom, or the default `מספר N`)
    is_active: bool = True


class NumberLabelIn(BaseModel):
    num_index: int
    label: str = ""    # empty / default → the slot falls back to `מספר N`
    is_active: bool = True


class NumberLabelsUpdate(BaseModel):
    """Bulk replace: the full set of numeric slots the company wants to set."""
    labels: list[NumberLabelIn] = []
