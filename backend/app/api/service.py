"""Service-to-service API (/api/service) for trusted first-party apps.

Authenticated by the `X-Service-Key` header (one shared secret, server-side only)
and scoped to a tenant via the required `company_id` query param. Mostly read;
the bedek app may also create/update customers (CRM stays the source of truth).

This is the surface the bedek app integrates against to pull a company's
real-estate (בדק) projects and customers, and to add/edit customers.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..deps import get_db, get_service_company, require_service_key
from ..models import Company
from ..schemas.customer import CustomerIn, CustomerOut
from ..schemas.realestate_project import RealEstateProjectOut
from ..services import customer_service, realestate_project_service


router = APIRouter(prefix="/api/service", tags=["service-api"])


@router.get("/companies", dependencies=[Depends(require_service_key)])
def list_companies(db: Session = Depends(get_db)):
    """All active companies (id + name). Cross-tenant — the consuming app uses
    this to mirror the company list and map each to its own tenant."""
    rows = (
        db.query(Company)
        .filter(Company.is_active.is_(True))
        .order_by(Company.name)
        .all()
    )
    return [{"id": c.id, "name": c.name} for c in rows]


@router.get("/company")
def get_company(company: Company = Depends(get_service_company)):
    """Whoami for the linked tenant — lets the caller confirm the mapping."""
    return {"id": company.id, "name": company.name}


@router.get("/realestate-projects", response_model=list[RealEstateProjectOut])
def list_realestate_projects(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    company: Company = Depends(get_service_company),
):
    """All real-estate (בדק) projects of the resolved company."""
    return [
        realestate_project_service.to_out(db, p)
        for p in realestate_project_service.list_projects(db, company.id, search)
    ]


@router.get("/customers", response_model=list[CustomerOut])
def list_customers(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    company: Company = Depends(get_service_company),
):
    """All active customers of the resolved company (soft-removed ones excluded)."""
    rows = customer_service.list_memberships(db, company.id, search, active_only=True)
    return [customer_service.to_out(db, m, c) for m, c in rows]


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    body: CustomerIn,
    db: Session = Depends(get_db),
    company: Company = Depends(get_service_company),
):
    """Create a customer + membership in the resolved company. bedek sends a
    minimal body (full_name required; the rest fall back to CustomerIn defaults).
    CRM is the source of truth; bedek keeps only the unit↔membership link."""
    m, c = customer_service.upsert_customer(db, company.id, body)
    return customer_service.to_out(db, m, c)


@router.put("/customers/{membership_id}", response_model=CustomerOut)
def update_customer(
    membership_id: int,
    body: CustomerIn,
    db: Session = Depends(get_db),
    company: Company = Depends(get_service_company),
):
    """Update an existing customer in the resolved company (404 if the membership
    isn't in this company)."""
    m, c = customer_service.upsert_customer(db, company.id, body, membership_id=membership_id)
    return customer_service.to_out(db, m, c)
