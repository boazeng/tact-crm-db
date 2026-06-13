from datetime import datetime
from enum import StrEnum

from sqlalchemy import String, DateTime, Boolean, Float, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class CustomerType(StrEnum):
    PERSON = "person"            # אדם פרטי
    ORGANIZATION = "organization"  # חברה / ארגון
    AUTHORIZED_DEALER = "authorized_dealer"  # עוסק מורשה


class Customer(Base):
    """A GLOBAL customer identity, shared across companies.

    A customer can be linked to more than one company (see CustomerCompany).
    These are the regular core details (shared). Anything company-specific —
    including every classification and the membership status — lives on the
    membership (CustomerCompany / CustomerFieldValue), never here.
    """

    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("customer_number", name="uq_customers_customer_number"),
        Index("ix_customers_email", "email"),
        Index("ix_customers_national_id", "national_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Human-facing unique customer number (global). Optional; unique when set.
    customer_number: Mapped[str | None] = mapped_column(String(40))
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[str | None] = mapped_column(String(120))  # תפקיד

    # person → ת.ז, organization → ח.פ (stored in national_id).
    customer_type: Mapped[str] = mapped_column(
        String(20), default=CustomerType.PERSON, nullable=False
    )
    # Only meaningful for organizations; kept NULL for private persons.
    company_name: Mapped[str | None] = mapped_column(String(200))
    # ת.ז לאדם פרטי / ח.פ לחברה. Also used for de-duplication across companies.
    national_id: Mapped[str | None] = mapped_column(String(40))
    # Marketing consent — defaults to allowed.
    allow_mailing: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Two addresses
    street1: Mapped[str | None] = mapped_column(String(200))
    city1: Mapped[str | None] = mapped_column(String(120))
    street2: Mapped[str | None] = mapped_column(String(200))
    city2: Mapped[str | None] = mapped_column(String(120))

    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(String(2000))

    # Configurable fields (global values; per-company labels live on the label
    # tables). Counts mirror the project model: 15 text params, 15 numbers,
    # 5 yes/no flags, 10 single-choice lists.
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


# Counts of the fixed configurable columns. Kept in one place so the
# schema/service can loop instead of hardcoding the numbers everywhere.
PARAM_COUNT = 15
NUM_COUNT = 15
FLAG_COUNT = 5
LIST_COUNT = 10
