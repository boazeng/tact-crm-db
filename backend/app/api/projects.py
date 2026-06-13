"""Projects within a company (JWT admin UI). Tenant-scoped via resolve_company_id."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, resolve_company_id
from ..models import User
from ..schemas.project import ProjectIn, ProjectOut
from ..services import project_service


router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return [project_service.to_out(db, p) for p in project_service.list_projects(db, company_id, search)]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return project_service.to_out(db, project_service.get_project(db, company_id, project_id))


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return project_service.to_out(db, project_service.upsert_project(db, company_id, body))


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    body: ProjectIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    p = project_service.upsert_project(db, company_id, body, project_id=project_id)
    return project_service.to_out(db, p)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    project_service.delete_project(db, company_id, project_id)
