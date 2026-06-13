"""DTOs for the Priority sync configuration surface."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PriorityConnectionIn(BaseModel):
    base_url: str = ""
    username: str | None = None
    # Empty/omitted password leaves the stored secret untouched.
    password: str | None = None
    entity_name: str = "CUSTOMERS"
    is_active: bool = True


class PriorityConnectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    base_url: str
    username: str | None
    entity_name: str
    is_active: bool
    # The password itself is never returned — only whether one is stored.
    password_set: bool = False
    last_tested_at: datetime | None = None
    last_test_ok: bool | None = None
    last_test_msg: str | None = None


class PriorityFieldOut(BaseModel):
    """A field discovered live from Priority."""
    name: str
    type: str = ""
    label: str = ""


class SystemFieldOut(BaseModel):
    key: str
    label: str
    group: str


class PriorityFieldMapIn(BaseModel):
    priority_field: str
    priority_label: str | None = None
    priority_type: str | None = None
    target_field: str | None = None
    is_imported: bool = True
    sort_order: int = 0


class PriorityFieldMapOut(PriorityFieldMapIn):
    model_config = ConfigDict(from_attributes=True)


class MappingBulkIn(BaseModel):
    rows: list[PriorityFieldMapIn]


class TestResult(BaseModel):
    ok: bool
    message: str
