from sqlalchemy import String, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class CustomerFieldValue(Base):
    """The value of one FieldDefinition for one membership (company+customer).

    Stored as text. The service layer serializes by field type:
    numbers/dates/booleans as strings, multiselect as a JSON-encoded list.
    Because it hangs off the membership, the same customer can carry totally
    different classification values in each company.
    """

    __tablename__ = "customer_field_values"
    __table_args__ = (
        UniqueConstraint(
            "membership_id", "field_definition_id", name="uq_membership_field"
        ),
        Index("ix_cfv_membership", "membership_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("customer_companies.id", ondelete="CASCADE"), nullable=False
    )
    field_definition_id: Mapped[int] = mapped_column(
        ForeignKey("field_definitions.id", ondelete="CASCADE"), nullable=False
    )
    value: Mapped[str | None] = mapped_column(String(2000))
