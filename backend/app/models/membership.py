from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    String, DateTime, Boolean, ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class MembershipStatus(StrEnum):
    LEAD = "lead"          # ליד
    ACTIVE = "active"      # פעיל
    INACTIVE = "inactive"  # לא פעיל


class MembershipSource(StrEnum):
    MANUAL = "manual"  # נוצר ידנית בממשק
    API = "api"        # נוצר דרך ה-API
    IMPORT = "import"  # יובא מקובץ
    SYNC = "sync"      # סונכרן ממערכת חיצונית


class CustomerCompany(Base):
    """The M:N membership linking a global Customer to a Company.

    THIS is the tenant-scoped row: every company-specific datum about a customer
    (status, source, and all classification field values) hangs off this record.
    A company can only ever reach a customer through its own membership row.
    """

    __tablename__ = "customer_companies"
    __table_args__ = (
        UniqueConstraint("company_id", "customer_id", name="uq_company_customer"),
        Index("ix_cc_company", "company_id"),
        Index("ix_cc_customer", "customer_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20), default=MembershipStatus.ACTIVE, nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(20), default=MembershipSource.MANUAL, nullable=False
    )
    # ID of this customer in the company's own external system (for future sync).
    external_ref: Mapped[str | None] = mapped_column(String(120))

    # --- Payment (within the SAME company) ---
    # Does this customer pay? If False, paid_by_membership_id names who pays instead.
    # (General customer-to-customer links now live in the customer_links table.)
    is_paying: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    paid_by_membership_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_companies.id", ondelete="SET NULL")
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
