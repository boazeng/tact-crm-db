from datetime import datetime

from sqlalchemy import (
    String, DateTime, Integer, Boolean, ForeignKey, Index, UniqueConstraint, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


# Default Hebrew label per field kind.
_KIND_PREFIX = {"param": "פרמטר", "number": "מספר", "flag": "דגל", "list": "רשימה"}


class ProjectFieldLabel(Base):
    """A per-company display name (and, for lists, the allowed options) for one of
    a Project's configurable fields. `kind` is 'param' | 'number' | 'flag' | 'list'
    and `idx` is the 1-based index within that kind. Only customized fields are
    stored; the rest fall back to their default label with no options."""

    __tablename__ = "project_field_labels"
    __table_args__ = (
        UniqueConstraint("company_id", "kind", "idx", name="uq_company_project_field"),
        Index("ix_project_field_label_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    options: Mapped[list | None] = mapped_column(JSON)  # only used for kind='list'
    # When False the field is hidden in the project form (not in use).
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Global display order across all kinds. NULL → fall back to the natural
    # order (param → number → flag → list, then by idx). Set by the
    # "סדר הצגה" admin tab when the user drags fields into a custom order.
    sort_order: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


def default_project_label(kind: str, idx: int) -> str:
    """The fallback label for a field a company hasn't renamed (e.g. `רשימה 2`)."""
    return f"{_KIND_PREFIX.get(kind, kind)} {idx}"
