from datetime import datetime
from enum import StrEnum

from sqlalchemy import String, DateTime, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class UserRole(StrEnum):
    SUPER_ADMIN = "super_admin"        # cross-tenant, manages all companies
    COMPANY_ADMIN = "company_admin"    # manages users + everything inside one company
    COMPANY_USER = "company_user"      # works on the company's customers


class User(Base):
    """A manager-level user. For super_admin the company_id is NULL (cross-tenant).

    This system has managers only — there is no end-customer login. A `customer`
    is data, not a user.
    """

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        Index("ix_users_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE")
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))

    role: Mapped[str] = mapped_column(String(30), nullable=False)

    # Reserved for Email+Password auth (Phase 2). Dev login ignores this.
    password_hash: Mapped[str | None] = mapped_column(String(255))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
