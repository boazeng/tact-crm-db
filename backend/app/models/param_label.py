from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ParamLabel(Base):
    """A per-company display name for one of the fixed customer parameters
    (param1..param10 on Customer). The parameter VALUES are global/shared; only
    the LABEL a company shows for each slot is tenant-scoped. A company that
    never renames a slot just sees the default `פרמטר N` (no row is stored).

    `param_index` is 1-based (1 → param1 ... 10 → param10)."""

    __tablename__ = "param_labels"
    __table_args__ = (
        UniqueConstraint("company_id", "param_index", name="uq_company_param_index"),
        Index("ix_param_label_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    param_index: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    # When False the field is hidden in the customer form (not in use).
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


def default_param_label(index: int) -> str:
    """The fallback label for a slot a company hasn't renamed (e.g. `פרמטר 3`)."""
    return f"פרמטר {index}"
