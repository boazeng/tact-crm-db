"""Schemas for per-company single-choice list fields (list1..list3): name + options."""
from pydantic import BaseModel


class ListFieldOut(BaseModel):
    list_index: int          # 1-based list (1 → list1 ... 10 → list10)
    label: str               # resolved label (custom, or the default `רשימה N`)
    options: list[str] = []  # the allowed choices for this list
    is_active: bool = True


class ListFieldIn(BaseModel):
    list_index: int
    label: str = ""              # empty / default → the list falls back to `רשימה N`
    options: list[str] = []      # the allowed choices
    is_active: bool = True


class ListFieldsUpdate(BaseModel):
    """Bulk replace: the full set of lists the company wants to configure."""
    labels: list[ListFieldIn] = []
