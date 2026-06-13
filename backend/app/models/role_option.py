from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class RoleOption(Base):
    """A per-company option for the customer 'role' (תפקיד) field. Each company
    starts with a default list and can manage its own (add/rename/remove). The
    customer form offers these as suggestions but still allows free text."""

    __tablename__ = "role_options"
    __table_args__ = (
        UniqueConstraint("company_id", "label", name="uq_company_role_option"),
        Index("ix_role_option_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


# The default list seeded for every new company.
DEFAULT_ROLE_OPTIONS = ["דייר", "ועד בית", "בעלים"]
