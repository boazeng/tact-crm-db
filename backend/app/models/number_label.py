from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class NumberLabel(Base):
    """A per-company display name for one of the customer's fixed numeric params
    (num1..num15 on Customer). The VALUES are global/shared; only the LABEL a
    company shows is tenant-scoped. A company that never renames a slot just sees
    the default `מספר N` (no row is stored).

    `num_index` is 1-based (1 → num1 ... 15 → num15)."""

    __tablename__ = "number_labels"
    __table_args__ = (
        UniqueConstraint("company_id", "num_index", name="uq_company_num_index"),
        Index("ix_number_label_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    num_index: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


def default_number_label(index: int) -> str:
    """The fallback label for a numeric slot a company hasn't renamed (e.g. `מספר 2`)."""
    return f"מספר {index}"
