"""Real-estate projects within a company (JWT admin UI). Tenant-scoped via
resolve_company_id."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, resolve_company_id
from ..models import User
from ..schemas.realestate_project import RealEstateProjectIn, RealEstateProjectOut
from ..services import realestate_project_service


router = APIRouter(prefix="/api/realestate-projects", tags=["realestate-projects"])


@router.get("", response_model=list[RealEstateProjectOut])
def list_projects(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return [realestate_project_service.to_out(db, p) for p in realestate_project_service.list_projects(db, company_id, search)]


@router.get("/{project_id}", response_model=RealEstateProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return realestate_project_service.to_out(db, realestate_project_service.get_project(db, company_id, project_id))


@router.post("", response_model=RealEstateProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    body: RealEstateProjectIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return realestate_project_service.to_out(db, realestate_project_service.upsert_project(db, company_id, body))


@router.put("/{project_id}", response_model=RealEstateProjectOut)
def update_project(
    project_id: int,
    body: RealEstateProjectIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    p = realestate_project_service.upsert_project(db, company_id, body, project_id=project_id)
    return realestate_project_service.to_out(db, p)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    realestate_project_service.delete_project(db, company_id, project_id)
