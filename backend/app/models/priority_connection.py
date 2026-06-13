from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class PriorityConnection(Base):
    """Per-company connection settings for the Priority ERP OData/REST API.

    One connection per company. Used to live-fetch the Priority field list for
    the mapping screen (and, in a later phase, to actually ingest customers).

    NOTE: `password` is stored as plaintext because we must authenticate
    OUTBOUND to Priority (unlike our own api_keys, which are hashed). For
    production this should move to an encrypted secret store.
    """

    __tablename__ = "priority_connections"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_priority_conn_company"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    # Full OData base URL up to and including the Priority company, ending with
    # "/" — e.g. https://server/odata/Priority/tabula.ini/demo/
    base_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    username: Mapped[str | None] = mapped_column(String(200))
    password: Mapped[str | None] = mapped_column(String(500))
    # Priority entity/form whose fields we map. Defaults to the customers form.
    entity_name: Mapped[str] = mapped_column(String(120), nullable=False, default="CUSTOMERS")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_test_ok: Mapped[bool | None] = mapped_column(Boolean)
    last_test_msg: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
