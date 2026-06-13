from datetime import datetime

from sqlalchemy import (
    String, DateTime, Integer, ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class DisplayColumn(Base):
    """A per-company choice of which customer field to show as a column in the
    main customers table. Each row is one column slot (ordered by `position`,
    0-based, up to 3). `kind` is 'param' | 'flag' | 'list' and `ref_index` is the
    1-based index within that kind (e.g. kind='param', ref_index=2 → param2)."""

    __tablename__ = "display_columns"
    __table_args__ = (
        UniqueConstraint("company_id", "position", name="uq_company_display_position"),
        Index("ix_display_col_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    ref_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


# How many columns a company may pick, and the default when none are configured.
MAX_DISPLAY_COLUMNS = 3
DEFAULT_DISPLAY_COLUMNS = [("param", 1), ("param", 2)]
