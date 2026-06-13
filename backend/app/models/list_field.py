from datetime import datetime

from sqlalchemy import (
    String, DateTime, Integer, Boolean, ForeignKey, Index, UniqueConstraint, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ListField(Base):
    """A per-company configuration for one of the fixed single-choice "list"
    fields (list1..list3 on Customer): its display name AND its allowed choices.
    The chosen VALUE is global/shared (on Customer); the label + options are
    tenant-scoped. A company that never configures a list just sees the default
    `רשימה N` with no options (no row is stored).

    `list_index` is 1-based (1 → list1 ... 3 → list3)."""

    __tablename__ = "list_fields"
    __table_args__ = (
        UniqueConstraint("company_id", "list_index", name="uq_company_list_index"),
        Index("ix_list_field_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    list_index: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    options: Mapped[list | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


def default_list_label(index: int) -> str:
    """The fallback label for a list a company hasn't configured (e.g. `רשימה 2`)."""
    return f"רשימה {index}"
