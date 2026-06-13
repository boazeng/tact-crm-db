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
    sample: str = ""
    description: str = ""   # Hebrew explanation of the Priority field
    suggested: str = ""     # recommended CRM target key, or "-" to skip


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


class IngestRequest(BaseModel):
    # Batch size for one call (number of Priority records to pull in this request).
    # Kept small so each request finishes within the API Gateway 30s timeout; the
    # client loops with a growing `offset` to ingest everyone.
    limit: int | None = None
    # How many Priority records to skip before this batch (OData $skip). When None
    # the old "stream everything in one call" behaviour is used (scripts/CLI only).
    offset: int | None = None


class IngestError(BaseModel):
    key: str | None = None
    error: str


class IngestSummary(BaseModel):
    total: int
    created: int
    updated: int
    skipped: int
    errors: list[IngestError] = []
    # True when this batch came back full, i.e. there are probably more records to
    # fetch — the client should call again with offset += limit.
    has_more: bool = False
