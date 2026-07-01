"""Real-estate project business logic (tenant-scoped). A project keeps basic data
plus a flexible block of configurable fields (params/numbers/flags/lists),
mirroring the project model."""
from datetime import datetime, date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import (
    RealEstateProject,
    Company,
    Customer,
    CustomerCompany,
    RE_PROJECT_PARAM_COUNT,
    RE_PROJECT_NUM_COUNT,
    RE_PROJECT_FLAG_COUNT,
    RE_PROJECT_LIST_COUNT,
)
from ..schemas.realestate_project import RealEstateProjectIn, RealEstateProjectOut


def list_projects(db: Session, company_id: int, search: str | None = None) -> list[RealEstateProject]:
    q = db.query(RealEstateProject).filter(RealEstateProject.company_id == company_id)
    if search:
        like = f"%{search}%"
        q = q.filter(RealEstateProject.name.ilike(like) | RealEstateProject.project_number.ilike(like))
    return q.order_by(RealEstateProject.name).all()


def get_project(db: Session, company_id: int, project_id: int) -> RealEstateProject:
    p = (
        db.query(RealEstateProject)
        .filter(RealEstateProject.id == project_id, RealEstateProject.company_id == company_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Real-estate project not found")
    return p


def _validate_customer(db: Session, company_id: int, membership_id: int | None) -> int | None:
    """The linked customer membership must belong to the same company."""
    if membership_id is None:
        return None
    ok = (
        db.query(CustomerCompany.id)
        .filter(CustomerCompany.id == membership_id, CustomerCompany.company_id == company_id)
        .first()
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer {membership_id} not found in this company",
        )
    return membership_id


def _next_project_number(db: Session, company_id: int) -> str:
    """Next running project number for the company.

    If the company has a `company_number` (assigned from 1001 for newer companies),
    the format is ``{company_number}-{NNN}`` with the running part zero-padded to at
    least 3 digits (…-999 then …-1000). Otherwise (pre-existing companies) it stays
    a plain running integer. Numbering is per-company."""
    company = db.query(Company).filter(Company.id == company_id).first()
    prefix = company.company_number if company else None
    numbers = [
        (n or "").strip()
        for (n,) in db.query(RealEstateProject.project_number)
        .filter(RealEstateProject.company_id == company_id)
        .all()
    ]
    if prefix:
        pref = f"{prefix}-"
        mx = 0
        for s in numbers:
            tail = s[len(pref):]
            if s.startswith(pref) and tail.isdigit():
                mx = max(mx, int(tail))
        return f"{prefix}-{mx + 1:03d}"
    mx = 0
    for s in numbers:
        if s.isdigit():
            mx = max(mx, int(s))
    return str(mx + 1)


def _ensure_unique_number(db: Session, company_id: int, number: str, project_id: int | None) -> None:
    """A manually-entered project number must be unique within the company."""
    q = db.query(RealEstateProject.id).filter(
        RealEstateProject.company_id == company_id,
        RealEstateProject.project_number == number,
    )
    if project_id is not None:
        q = q.filter(RealEstateProject.id != project_id)
    if q.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"מספר פרויקט '{number}' כבר קיים בחברה זו",
        )


def _resolve_project_number(
    db: Session, company_id: int, project: RealEstateProject, raw: str | None, project_id: int | None
) -> str:
    """Manual number → kept (after a uniqueness check). Empty on create → the next
    running number. Empty on update → keep the project's existing number."""
    raw = (raw or "").strip()
    if raw:
        _ensure_unique_number(db, company_id, raw, project_id)
        return raw
    if project_id is None:
        return _next_project_number(db, company_id)
    return project.project_number or _next_project_number(db, company_id)


def _apply(project: RealEstateProject, body: RealEstateProjectIn) -> None:
    # project_number is resolved separately (auto-numbering + uniqueness).
    project.name = body.name
    project.description = body.description
    project.notes = body.notes
    project.creation_date = body.creation_date or project.creation_date or date.today()
    for i in range(RE_PROJECT_PARAM_COUNT):
        setattr(project, f"param{i + 1}", body.params[i] if i < len(body.params) else None)
    for i in range(RE_PROJECT_NUM_COUNT):
        setattr(project, f"num{i + 1}", body.numbers[i] if i < len(body.numbers) else None)
    for i in range(RE_PROJECT_FLAG_COUNT):
        setattr(project, f"flag{i + 1}", bool(body.flags[i]) if i < len(body.flags) else False)
    for i in range(RE_PROJECT_LIST_COUNT):
        setattr(project, f"list{i + 1}", body.lists[i] if i < len(body.lists) else None)


def upsert_project(
    db: Session, company_id: int, body: RealEstateProjectIn, project_id: int | None = None
) -> RealEstateProject:
    if project_id is not None:
        project = get_project(db, company_id, project_id)
    else:
        project = RealEstateProject(company_id=company_id, name=body.name)
        db.add(project)
    _apply(project, body)
    project.project_number = _resolve_project_number(
        db, company_id, project, body.project_number, project_id
    )
    project.customer_membership_id = _validate_customer(db, company_id, body.customer_membership_id)
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, company_id: int, project_id: int) -> None:
    project = get_project(db, company_id, project_id)
    db.delete(project)
    db.commit()


def _customer_name(db: Session, membership_id: int | None) -> str | None:
    if membership_id is None:
        return None
    row = (
        db.query(Customer.full_name)
        .join(CustomerCompany, CustomerCompany.customer_id == Customer.id)
        .filter(CustomerCompany.id == membership_id)
        .first()
    )
    return row[0] if row else None


def to_out(db: Session, project: RealEstateProject) -> RealEstateProjectOut:
    return RealEstateProjectOut(
        id=project.id,
        company_id=project.company_id,
        project_number=project.project_number,
        name=project.name,
        description=project.description,
        customer_membership_id=project.customer_membership_id,
        customer_name=_customer_name(db, project.customer_membership_id),
        notes=project.notes,
        creation_date=project.creation_date,
        params=[getattr(project, f"param{i + 1}") for i in range(RE_PROJECT_PARAM_COUNT)],
        numbers=[getattr(project, f"num{i + 1}") for i in range(RE_PROJECT_NUM_COUNT)],
        flags=[bool(getattr(project, f"flag{i + 1}")) for i in range(RE_PROJECT_FLAG_COUNT)],
        lists=[getattr(project, f"list{i + 1}") for i in range(RE_PROJECT_LIST_COUNT)],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )
