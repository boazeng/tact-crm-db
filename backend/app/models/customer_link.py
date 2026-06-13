from sqlalchemy import String, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class CustomerLink(Base):
    """A directed link between two customers of the SAME company, with a role
    (תפקיד) describing the linked customer — e.g. ועד בית, אפוטרופוס, בן/בת זוג.

    Replaces the old single parent ("לקוח-על") pointer: a customer can now be
    linked to many others, each with its own role.
    """

    __tablename__ = "customer_links"
    __table_args__ = (
        UniqueConstraint("membership_id", "linked_membership_id", name="uq_customer_link"),
        Index("ix_clink_membership", "membership_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("customer_companies.id", ondelete="CASCADE"), nullable=False
    )
    linked_membership_id: Mapped[int] = mapped_column(
        ForeignKey("customer_companies.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str | None] = mapped_column(String(120))  # תפקיד
