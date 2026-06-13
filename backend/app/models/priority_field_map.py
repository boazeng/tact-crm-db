from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class PriorityFieldMap(Base):
    """One row of the Priority→CRM field mapping, per company.

    Each row pins a single Priority field (e.g. ``CUSTNAME``) to a target field
    in our system (``target_field``, e.g. ``full_name`` / ``param3`` /
    ``fd:status`` for a classification). ``is_imported=False`` means "do NOT
    ingest this Priority field" — the user's request to skip certain fields.
    """

    __tablename__ = "priority_field_maps"
    __table_args__ = (
        UniqueConstraint("company_id", "priority_field", name="uq_priority_map_field"),
        Index("ix_priority_map_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    # Priority property/column name (from the OData $metadata).
    priority_field: Mapped[str] = mapped_column(String(120), nullable=False)
    # Display name + OData type, captured at mapping time for stable rendering.
    priority_label: Mapped[str | None] = mapped_column(String(200))
    priority_type: Mapped[str | None] = mapped_column(String(80))
    # Our system field key, or NULL when not mapped yet. See system_fields().
    target_field: Mapped[str | None] = mapped_column(String(80))
    # Whether to ingest this Priority field at all.
    is_imported: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
