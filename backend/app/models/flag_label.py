from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class FlagLabel(Base):
    """A per-company display name for one of the fixed yes/no flags
    (flag1..flag3 on Customer). The flag VALUES are global/shared; only the
    LABEL a company shows for each flag is tenant-scoped. A company that never
    renames a flag just sees the default `דגל N` (no row is stored).

    `flag_index` is 1-based (1 → flag1 ... 3 → flag3)."""

    __tablename__ = "flag_labels"
    __table_args__ = (
        UniqueConstraint("company_id", "flag_index", name="uq_company_flag_index"),
        Index("ix_flag_label_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    flag_index: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


def default_flag_label(index: int) -> str:
    """The fallback label for a flag a company hasn't renamed (e.g. `דגל 2`)."""
    return f"דגל {index}"
