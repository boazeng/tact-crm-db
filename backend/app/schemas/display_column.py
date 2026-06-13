"""Schemas for the per-company choice of customer-table columns."""
from pydantic import BaseModel


class DisplayColumnOut(BaseModel):
    kind: str        # 'param' | 'flag' | 'list'
    ref_index: int   # 1-based index within that kind


class DisplayColumnIn(BaseModel):
    kind: str
    ref_index: int


class DisplayColumnsUpdate(BaseModel):
    """Bulk replace: the ordered set of columns the company wants to show."""
    columns: list[DisplayColumnIn] = []
