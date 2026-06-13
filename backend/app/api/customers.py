"""Customers within a company (JWT admin UI). Tenant-scoped via resolve_company_id."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, resolve_company_id
from ..models import User
from ..schemas.customer import CustomerIn, CustomerOut
from ..services import customer_service


router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def list_customers(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None, description="Keep only this membership status, e.g. 'lead'"),
    exclude_status: str | None = Query(default=None, description="Drop this membership status, e.g. 'lead'"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    rows = customer_service.list_memberships(
        db, company_id, search, status=status, exclude_status=exclude_status
    )
    return [customer_service.to_out(db, m, c) for m, c in rows]


@router.get("/{membership_id}", response_model=CustomerOut)
def get_customer(
    membership_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    m, c = customer_service.get_membership(db, company_id, membership_id)
    return customer_service.to_out(db, m, c)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    body: CustomerIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    m, c = customer_service.upsert_customer(db, company_id, body)
    return customer_service.to_out(db, m, c)


@router.put("/{membership_id}", response_model=CustomerOut)
def update_customer(
    membership_id: int,
    body: CustomerIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    m, c = customer_service.upsert_customer(db, company_id, body, membership_id=membership_id)
    return customer_service.to_out(db, m, c)


@router.delete("/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_customer(
    membership_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    customer_service.unlink_customer(db, company_id, membership_id)
