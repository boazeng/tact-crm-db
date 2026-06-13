"""Programmatic API (versioned, /api/v1) authenticated by the X-API-Key header.

Same customer business logic as the admin UI, but the tenant is resolved from the
API key instead of a JWT. This is the surface external systems integrate against.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..deps import get_api_company, get_db
from ..models import Company
from ..schemas.customer import CustomerIn, CustomerOut
from ..services import customer_service


router = APIRouter(prefix="/api/v1", tags=["public-api"])


@router.get("/customers", response_model=list[CustomerOut])
def list_customers(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    company: Company = Depends(get_api_company),
):
    rows = customer_service.list_memberships(db, company.id, search)
    return [customer_service.to_out(db, m, c) for m, c in rows]


@router.get("/customers/{membership_id}", response_model=CustomerOut)
def get_customer(
    membership_id: int,
    db: Session = Depends(get_db),
    company: Company = Depends(get_api_company),
):
    m, c = customer_service.get_membership(db, company.id, membership_id)
    return customer_service.to_out(db, m, c)


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    body: CustomerIn,
    db: Session = Depends(get_db),
    company: Company = Depends(get_api_company),
):
    if body.source == "manual":
        body.source = "api"
    m, c = customer_service.upsert_customer(db, company.id, body)
    return customer_service.to_out(db, m, c)


@router.put("/customers/{membership_id}", response_model=CustomerOut)
def update_customer(
    membership_id: int,
    body: CustomerIn,
    db: Session = Depends(get_db),
    company: Company = Depends(get_api_company),
):
    m, c = customer_service.upsert_customer(db, company.id, body, membership_id=membership_id)
    return customer_service.to_out(db, m, c)
