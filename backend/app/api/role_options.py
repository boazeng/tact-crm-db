"""Per-company role (תפקיד) options. Any user in the company may read them (the
customer form needs the suggestions); only a company admin may manage them."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_company_admin, resolve_company_id
from ..models import RoleOption, User
from ..schemas.role_option import RoleOptionIn, RoleOptionOut


router = APIRouter(prefix="/api/role-options", tags=["role-options"])


@router.get("", response_model=list[RoleOptionOut])
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return (
        db.query(RoleOption)
        .filter(RoleOption.company_id == company_id, RoleOption.is_active.is_(True))
        .order_by(RoleOption.sort_order, RoleOption.id)
        .all()
    )


@router.post("", response_model=RoleOptionOut, status_code=status.HTTP_201_CREATED)
def create_role(
    body: RoleOptionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    ro = RoleOption(company_id=company_id, **body.model_dump())
    db.add(ro)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role '{body.label}' already exists for this company",
        )
    db.refresh(ro)
    return ro


@router.put("/{role_id}", response_model=RoleOptionOut)
def update_role(
    role_id: int,
    body: RoleOptionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    ro = (
        db.query(RoleOption)
        .filter(RoleOption.id == role_id, RoleOption.company_id == company_id)
        .first()
    )
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for k, v in body.model_dump().items():
        setattr(ro, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Label conflict")
    db.refresh(ro)
    return ro


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    ro = (
        db.query(RoleOption)
        .filter(RoleOption.id == role_id, RoleOption.company_id == company_id)
        .first()
    )
    if not ro:
        return
    ro.is_active = False
    db.commit()
