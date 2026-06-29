"""Service-to-service API (/api/service) for trusted first-party apps.

Authenticated by the `X-Service-Key` header (one shared secret, server-side only)
and scoped to a tenant via the required `company_id` query param. Read-only.

This is the surface the bedek app integrates against to pull a company's
real-estate (בדק) projects and customers.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..deps import get_db, get_service_company
from ..models import Company
from ..schemas.customer import CustomerOut
from ..schemas.realestate_project import RealEstateProjectOut
from ..services import customer_service, realestate_project_service


router = APIRouter(prefix="/api/service", tags=["service-api"])


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
    """All customers of the resolved company."""
    rows = customer_service.list_memberships(db, company.id, search)
    return [customer_service.to_out(db, m, c) for m, c in rows]
