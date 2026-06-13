from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    String, DateTime, Boolean, Integer, ForeignKey, Index, UniqueConstraint, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class FieldType(StrEnum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    SELECT = "select"            # single choice — the typical "classification"
    MULTISELECT = "multiselect"  # multiple choices


# Types whose `options` list is meaningful / required.
CHOICE_TYPES = (FieldType.SELECT, FieldType.MULTISELECT)


class FieldDefinition(Base):
    """A custom field a COMPANY defines to classify its customers.

    Per-company (tenant-scoped). A classification is simply a field of type
    `select` / `multiselect`. `options` holds the allowed choices for those.
    """

    __tablename__ = "field_definitions"
    __table_args__ = (
        UniqueConstraint("company_id", "key", name="uq_company_field_key"),
        Index("ix_fd_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    # Stable machine key (e.g. "status", "rating"); unique within the company.
    key: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # For select/multiselect: ["ליד", "פעיל", ...]. Empty/None otherwise.
    options: Mapped[list | None] = mapped_column(JSON)

    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
