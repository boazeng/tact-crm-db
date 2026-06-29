"""Customer business logic shared by the JWT admin API and the X-API-Key public API.

Encapsulates the global-identity + M:N-membership model: a global Customer is
found-or-created (de-duped by national_id/email), linked to the company via a
CustomerCompany membership, and the company's classification field values are
upserted onto that membership.
"""
from datetime import datetime, date
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import (
    Customer,
    CustomerCompany,
    CustomerFieldValue,
    CustomerLink,
    CustomerType,
    FieldDefinition,
    PARAM_COUNT,
    NUM_COUNT,
    FLAG_COUNT,
    LIST_COUNT,
)
from ..schemas.customer import CustomerIn, CustomerOut
from . import field_service


# ---------- queries ----------
def list_memberships(
    db: Session,
    company_id: int,
    search: str | None = None,
    status: str | None = None,
    exclude_status: str | None = None,
    active_only: bool = False,
) -> list[tuple[CustomerCompany, Customer]]:
    """List a company's memberships. `status` keeps only that membership status
    (e.g. "lead"); `exclude_status` drops it (e.g. customers view hides leads).
    `active_only` drops soft-removed (unlinked) memberships."""
    q = (
        db.query(CustomerCompany, Customer)
        .join(Customer, Customer.id == CustomerCompany.customer_id)
        .filter(CustomerCompany.company_id == company_id)
    )
    if active_only:
        q = q.filter(CustomerCompany.is_active.is_(True))
    if status:
        q = q.filter(CustomerCompany.status == status)
    if exclude_status:
        q = q.filter(CustomerCompany.status != exclude_status)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Customer.full_name.ilike(like))
            | (Customer.nickname.ilike(like))
            | (Customer.customer_number.ilike(like))
            | (Customer.email.ilike(like))
            | (Customer.phone.ilike(like))
            | (Customer.national_id.ilike(like))
        )
    return q.order_by(Customer.full_name).all()


def list_options(
    db: Session, company_id: int, exclude_status: str | None = None
) -> list[dict]:
    """Lightweight name list for pickers — one query, 3 columns, no per-row
    ``to_out`` (which fans out into field-value/link/name sub-queries). This is
    what dropdowns should use instead of the full customer list."""
    q = (
        db.query(CustomerCompany.id, Customer.full_name, Customer.customer_number)
        .join(Customer, Customer.id == CustomerCompany.customer_id)
        .filter(CustomerCompany.company_id == company_id)
    )
    if exclude_status:
        q = q.filter(CustomerCompany.status != exclude_status)
    return [
        {"membership_id": mid, "full_name": name, "customer_number": num}
        for mid, name, num in q.order_by(Customer.full_name).all()
    ]


def get_membership(
    db: Session, company_id: int, membership_id: int
) -> tuple[CustomerCompany, Customer]:
    row = (
        db.query(CustomerCompany, Customer)
        .join(Customer, Customer.id == CustomerCompany.customer_id)
        .filter(
            CustomerCompany.id == membership_id,
            CustomerCompany.company_id == company_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return row


def _validate_link(
    db: Session, company_id: int, ref_id: int | None, self_id: int | None
) -> int | None:
    """Validate a customer-to-customer link: the referenced membership must exist,
    belong to the SAME company, and not be the membership itself."""
    if ref_id is None:
        return None
    if ref_id == self_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer cannot be linked to itself",
        )
    target = (
        db.query(CustomerCompany)
        .filter(CustomerCompany.id == ref_id, CustomerCompany.company_id == company_id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Linked customer {ref_id} not found in this company",
        )
    return ref_id


def _name_of(db: Session, membership_id: int | None) -> str | None:
    if membership_id is None:
        return None
    row = (
        db.query(Customer.full_name)
        .join(CustomerCompany, CustomerCompany.customer_id == Customer.id)
        .filter(CustomerCompany.id == membership_id)
        .first()
    )
    return row[0] if row else None


def _active_field_defs(db: Session, company_id: int) -> dict[str, FieldDefinition]:
    rows = (
        db.query(FieldDefinition)
        .filter(
            FieldDefinition.company_id == company_id,
            FieldDefinition.is_active.is_(True),
        )
        .all()
    )
    return {fd.key: fd for fd in rows}


# ---------- writes ----------
def _apply_core(customer: Customer, body: CustomerIn) -> None:
    """Copy all shared core identity fields (incl. the 10 fixed params) onto the
    global customer record."""
    customer.customer_number = body.customer_number
    customer.full_name = body.full_name
    customer.nickname = body.nickname
    customer.role = body.role
    customer.customer_type = body.customer_type
    # company_name only applies to organizations; cleared for private persons.
    customer.company_name = (
        body.company_name if body.customer_type == CustomerType.ORGANIZATION else None
    )
    customer.national_id = body.national_id
    customer.street1 = body.street1
    customer.city1 = body.city1
    customer.street2 = body.street2
    customer.city2 = body.city2
    customer.phone = body.phone
    customer.email = body.email
    customer.allow_mailing = body.allow_mailing
    customer.notes = body.notes
    # Explicit date wins; otherwise keep an existing one; otherwise default today.
    customer.creation_date = body.creation_date or customer.creation_date or date.today()
    for i in range(PARAM_COUNT):
        setattr(customer, f"param{i + 1}", body.params[i] if i < len(body.params) else None)
    for i in range(NUM_COUNT):
        setattr(customer, f"num{i + 1}", body.numbers[i] if i < len(body.numbers) else None)
    for i in range(FLAG_COUNT):
        setattr(customer, f"flag{i + 1}", bool(body.flags[i]) if i < len(body.flags) else False)
    for i in range(LIST_COUNT):
        setattr(customer, f"list{i + 1}", body.lists[i] if i < len(body.lists) else None)


def _find_or_create_customer(db: Session, body: CustomerIn) -> Customer:
    existing: Customer | None = None
    if body.national_id:
        existing = db.query(Customer).filter(Customer.national_id == body.national_id).first()
    if existing is None and body.email:
        existing = db.query(Customer).filter(Customer.email == body.email).first()

    customer = existing or Customer(full_name=body.full_name)
    _apply_core(customer, body)
    if existing is None:
        db.add(customer)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Customer number '{body.customer_number}' is already in use",
            )
    return customer


def _set_field_values(
    db: Session, company_id: int, membership: CustomerCompany, fields: dict[str, Any]
) -> None:
    defs = _active_field_defs(db, company_id)
    unknown = [k for k in fields if k not in defs]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown field keys: {unknown}",
        )
    existing = {
        v.field_definition_id: v
        for v in db.query(CustomerFieldValue).filter(
            CustomerFieldValue.membership_id == membership.id
        )
    }
    for key, raw in fields.items():
        fd = defs[key]
        stored = field_service.serialize_value(fd, raw)
        row = existing.get(fd.id)
        if row:
            row.value = stored
        else:
            db.add(
                CustomerFieldValue(
                    membership_id=membership.id,
                    field_definition_id=fd.id,
                    value=stored,
                )
            )


def _pairs_of(db: Session, me: int) -> list[CustomerLink]:
    """All link rows touching membership `me` (either endpoint) — links are
    undirected, stored once per pair."""
    return (
        db.query(CustomerLink)
        .filter(or_(CustomerLink.membership_id == me, CustomerLink.linked_membership_id == me))
        .all()
    )


def _set_links(
    db: Session, company_id: int, membership: CustomerCompany, links
) -> None:
    """Reconcile this membership's undirected links with the given list (each
    {linked_membership_id, role}). A link is a single normalized pair, so adding
    or removing it from either customer affects the same row — links are
    bidirectional. Targets must be in the same company."""
    me = membership.id
    desired: dict[int, str | None] = {}
    for link in links:
        target = _validate_link(db, company_id, link.linked_membership_id, me)
        if target is not None and target not in desired:
            desired[target] = link.role

    existing_by_other: dict[int, CustomerLink] = {}
    for row in _pairs_of(db, me):
        other = row.linked_membership_id if row.membership_id == me else row.membership_id
        existing_by_other[other] = row

    for other, row in existing_by_other.items():
        if other not in desired:
            db.delete(row)
    for other, role in desired.items():
        row = existing_by_other.get(other)
        if row is not None:
            row.role = role
        else:
            a, b = sorted((me, other))  # normalize so each pair is stored once
            db.add(CustomerLink(membership_id=a, linked_membership_id=b, role=role))


def upsert_customer(
    db: Session, company_id: int, body: CustomerIn, membership_id: int | None = None
) -> tuple[CustomerCompany, Customer]:
    """Create or update a customer within a company. When `membership_id` is given
    the membership's core customer is updated in place; otherwise it's found-or-created."""
    if membership_id is not None:
        membership, customer = get_membership(db, company_id, membership_id)
        _apply_core(customer, body)
    else:
        customer = _find_or_create_customer(db, body)
        membership = (
            db.query(CustomerCompany)
            .filter(
                CustomerCompany.company_id == company_id,
                CustomerCompany.customer_id == customer.id,
            )
            .first()
        )
        if membership is None:
            membership = CustomerCompany(company_id=company_id, customer_id=customer.id)
            db.add(membership)
            db.flush()

    membership.status = body.status
    membership.source = body.source
    membership.external_ref = body.external_ref
    membership.is_active = True
    customer.updated_at = datetime.utcnow()

    membership.is_paying = body.is_paying
    membership.paid_by_membership_id = (
        None
        if body.is_paying
        else _validate_link(db, company_id, body.paid_by_membership_id, membership.id)
    )

    _set_field_values(db, company_id, membership, body.fields)
    _set_links(db, company_id, membership, body.links)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer number '{body.customer_number}' is already in use",
        )
    db.refresh(membership)
    db.refresh(customer)
    return membership, customer


def unlink_customer(db: Session, company_id: int, membership_id: int) -> None:
    """Soft-remove a customer from a company (the global customer is untouched)."""
    membership, _ = get_membership(db, company_id, membership_id)
    membership.is_active = False
    membership.status = "inactive"
    db.commit()


# ---------- serialization ----------
def to_out(db: Session, membership: CustomerCompany, customer: Customer) -> CustomerOut:
    # Only ACTIVE field definitions are surfaced — values of soft-deleted fields
    # are kept in the DB but hidden, so they aren't sent back and re-validated.
    defs = {
        fd.id: fd
        for fd in db.query(FieldDefinition).filter(
            FieldDefinition.company_id == membership.company_id,
            FieldDefinition.is_active.is_(True),
        )
    }
    values = db.query(CustomerFieldValue).filter(
        CustomerFieldValue.membership_id == membership.id
    )
    fields: dict[str, Any] = {}
    for v in values:
        fd = defs.get(v.field_definition_id)
        if fd:
            fields[fd.key] = field_service.deserialize_value(fd, v.value)

    links = []
    for row in _pairs_of(db, membership.id):
        other = row.linked_membership_id if row.membership_id == membership.id else row.membership_id
        links.append(
            {
                "linked_membership_id": other,
                "role": row.role,
                "name": _name_of(db, other),
            }
        )

    return CustomerOut(
        membership_id=membership.id,
        company_id=membership.company_id,
        status=membership.status,
        source=membership.source,
        external_ref=membership.external_ref,
        joined_at=membership.joined_at,
        is_paying=membership.is_paying,
        paid_by_membership_id=membership.paid_by_membership_id,
        paid_by_name=_name_of(db, membership.paid_by_membership_id),
        links=links,
        id=customer.id,
        customer_number=customer.customer_number,
        full_name=customer.full_name,
        customer_type=customer.customer_type,
        company_name=customer.company_name,
        national_id=customer.national_id,
        nickname=customer.nickname,
        role=customer.role,
        street1=customer.street1,
        city1=customer.city1,
        street2=customer.street2,
        city2=customer.city2,
        phone=customer.phone,
        email=customer.email,
        allow_mailing=customer.allow_mailing,
        notes=customer.notes,
        creation_date=customer.creation_date,
        params=[getattr(customer, f"param{i + 1}") for i in range(PARAM_COUNT)],
        numbers=[getattr(customer, f"num{i + 1}") for i in range(NUM_COUNT)],
        flags=[bool(getattr(customer, f"flag{i + 1}")) for i in range(FLAG_COUNT)],
        lists=[getattr(customer, f"list{i + 1}") for i in range(LIST_COUNT)],
        created_at=customer.created_at,
        updated_at=customer.updated_at,
        fields=fields,
    )
