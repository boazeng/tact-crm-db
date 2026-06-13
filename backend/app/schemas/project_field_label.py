"""Schemas for per-company project field labels (param/number/flag/list)."""
from pydantic import BaseModel


class ProjectFieldLabelOut(BaseModel):
    kind: str                # 'param' | 'number' | 'flag' | 'list'
    idx: int                 # 1-based index within the kind
    label: str               # resolved label (custom or default)
    options: list[str] = []  # only meaningful for kind='list'
    is_active: bool = True    # when False the field is hidden in the project form
    sort_order: int          # resolved global display order


class ProjectFieldLabelIn(BaseModel):
    kind: str
    idx: int
    label: str = ""
    options: list[str] = []
    is_active: bool = True


class ProjectFieldLabelsUpdate(BaseModel):
    labels: list[ProjectFieldLabelIn] = []


class ProjectFieldRef(BaseModel):
    """One field identified by kind + idx, used to express a display order."""
    kind: str
    idx: int


class ProjectFieldOrderUpdate(BaseModel):
    # The full list of fields in the desired display order.
    order: list[ProjectFieldRef] = []
