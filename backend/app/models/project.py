from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, Boolean, Float, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base

# Counts of the fixed configurable project fields (labels are per-company).
PROJECT_PARAM_COUNT = 15   # free-text params
PROJECT_NUM_COUNT = 15     # numeric params
PROJECT_FLAG_COUNT = 5     # yes/no flags
PROJECT_LIST_COUNT = 10    # single-choice lists


class Project(Base):
    """A company project (tenant-scoped). Keeps a small set of BASIC fields, then
    a flexible block of configurable fields — text params, numeric params, yes/no
    flags and single-choice lists — mirroring the customer model. The per-company
    display names (and list options) live on ProjectFieldLabel."""

    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    # Optional link to a customer membership within the SAME company.
    customer_membership_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_companies.id", ondelete="SET NULL")
    )

    # ---- basic data ----
    project_number: Mapped[str | None] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))  # תיאור הפרויקט
    notes: Mapped[str | None] = mapped_column(String(2000))
    # User-editable creation date (defaults to today on create; editable).
    creation_date: Mapped[date | None] = mapped_column(Date)

    # ---- configurable fields (labels per-company on ProjectFieldLabel) ----
    param1: Mapped[str | None] = mapped_column(String(500))
    param2: Mapped[str | None] = mapped_column(String(500))
    param3: Mapped[str | None] = mapped_column(String(500))
    param4: Mapped[str | None] = mapped_column(String(500))
    param5: Mapped[str | None] = mapped_column(String(500))
    param6: Mapped[str | None] = mapped_column(String(500))
    param7: Mapped[str | None] = mapped_column(String(500))
    param8: Mapped[str | None] = mapped_column(String(500))
    param9: Mapped[str | None] = mapped_column(String(500))
    param10: Mapped[str | None] = mapped_column(String(500))
    param11: Mapped[str | None] = mapped_column(String(500))
    param12: Mapped[str | None] = mapped_column(String(500))
    param13: Mapped[str | None] = mapped_column(String(500))
    param14: Mapped[str | None] = mapped_column(String(500))
    param15: Mapped[str | None] = mapped_column(String(500))

    num1: Mapped[float | None] = mapped_column(Float)
    num2: Mapped[float | None] = mapped_column(Float)
    num3: Mapped[float | None] = mapped_column(Float)
    num4: Mapped[float | None] = mapped_column(Float)
    num5: Mapped[float | None] = mapped_column(Float)
    num6: Mapped[float | None] = mapped_column(Float)
    num7: Mapped[float | None] = mapped_column(Float)
    num8: Mapped[float | None] = mapped_column(Float)
    num9: Mapped[float | None] = mapped_column(Float)
    num10: Mapped[float | None] = mapped_column(Float)
    num11: Mapped[float | None] = mapped_column(Float)
    num12: Mapped[float | None] = mapped_column(Float)
    num13: Mapped[float | None] = mapped_column(Float)
    num14: Mapped[float | None] = mapped_column(Float)
    num15: Mapped[float | None] = mapped_column(Float)

    flag1: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag2: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag3: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag4: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag5: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    list1: Mapped[str | None] = mapped_column(String(500))
    list2: Mapped[str | None] = mapped_column(String(500))
    list3: Mapped[str | None] = mapped_column(String(500))
    list4: Mapped[str | None] = mapped_column(String(500))
    list5: Mapped[str | None] = mapped_column(String(500))
    list6: Mapped[str | None] = mapped_column(String(500))
    list7: Mapped[str | None] = mapped_column(String(500))
    list8: Mapped[str | None] = mapped_column(String(500))
    list9: Mapped[str | None] = mapped_column(String(500))
    list10: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
