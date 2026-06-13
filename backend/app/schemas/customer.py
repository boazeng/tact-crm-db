"""Schemas for customers as seen within a company (core identity + membership + field values)."""
from datetime import datetime, date
from typing import Any

from pydantic import BaseModel, ConfigDict


class CustomerLinkIn(BaseModel):
    linked_membership_id: int
    role: str | None = None   # תפקיד


class CustomerLinkOut(BaseModel):
    linked_membership_id: int
    role: str | None = None
    name: str | None = None   # linked customer's name, for display


class CustomerIn(BaseModel):
    """Create/update payload. Core identity fields + a {field_key: value} map of
    this company's custom classification values."""

    customer_number: str | None = None
    full_name: str
    customer_type: str = "person"        # person (פרטי) / organization (חברה)
    company_name: str | None = None      # only for organizations
    national_id: str | None = None       # ת.ז (פרטי) / ח.פ (חברה)
    nickname: str | None = None
    role: str | None = None              # תפקיד
    street1: str | None = None
    city1: str | None = None
    street2: str | None = None
    city2: str | None = None
    phone: str | None = None
    email: str | None = None
    allow_mailing: bool = True           # מאפשר דיוור — default yes
    notes: str | None = None
    # Editable creation date (תאריך יצירה). Omitted → server defaults to today on
    # create, or keeps the existing value on update.
    creation_date: date | None = None
    # 10 fixed parameters (index 0 = פרמטר 1 ... index 9 = פרמטר 10).
    params: list[str | None] = []
    # 15 numeric params.
    numbers: list[float | None] = []
    # 5 fixed yes/no flags.
    flags: list[bool] = []
    # 10 fixed single-choice list values.
    lists: list[str | None] = []

    # Membership (company-specific) attributes:
    status: str = "active"
    source: str = "manual"
    external_ref: str | None = None

    # Payment (membership ids within the same company):
    is_paying: bool = True
    paid_by_membership_id: int | None = None   # who pays when is_paying is False

    # Linked customers (each with a role/תפקיד).
    links: list[CustomerLinkIn] = []

    # Classification values keyed by FieldDefinition.key. Coerced by field type.
    fields: dict[str, Any] = {}


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # membership identity
    membership_id: int
    company_id: int
    status: str
    source: str
    external_ref: str | None
    joined_at: datetime

    # payment
    is_paying: bool = True
    paid_by_membership_id: int | None = None
    paid_by_name: str | None = None

    # linked customers (with roles + resolved names)
    links: list[CustomerLinkOut] = []

    # shared core identity
    id: int                       # customer id
    customer_number: str | None
    full_name: str
    customer_type: str
    company_name: str | None
    national_id: str | None
    nickname: str | None
    role: str | None
    street1: str | None
    city1: str | None
    street2: str | None
    city2: str | None
    phone: str | None
    email: str | None
    allow_mailing: bool
    notes: str | None
    creation_date: date | None = None
    params: list[str | None] = []
    numbers: list[float | None] = []
    flags: list[bool] = []
    lists: list[str | None] = []
    created_at: datetime
    updated_at: datetime

    # classification values keyed by FieldDefinition.key (typed)
    fields: dict[str, Any] = {}
