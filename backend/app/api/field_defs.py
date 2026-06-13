"""Per-company custom field (classification) definitions. Company admin only."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..deps import get_db, require_company_admin, resolve_company_id
from ..models import FieldDefinition, User
from ..schemas.field_def import FieldDefinitionIn, FieldDefinitionOut


router = APIRouter(prefix="/api/field-definitions", tags=["field-definitions"])


@router.get("", response_model=list[FieldDefinitionOut])
def list_fields(
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    return (
        db.query(FieldDefinition)
        .filter(FieldDefinition.company_id == company_id)
        .order_by(FieldDefinition.sort_order, FieldDefinition.id)
        .all()
    )


@router.post("", response_model=FieldDefinitionOut, status_code=status.HTTP_201_CREATED)
def create_field(
    body: FieldDefinitionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    fd = FieldDefinition(company_id=company_id, **body.model_dump())
    db.add(fd)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Field key '{body.key}' already exists for this company",
        )
    db.refresh(fd)
    return fd


@router.put("/{field_id}", response_model=FieldDefinitionOut)
def update_field(
    field_id: int,
    body: FieldDefinitionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    fd = (
        db.query(FieldDefinition)
        .filter(FieldDefinition.id == field_id, FieldDefinition.company_id == company_id)
        .first()
    )
    if not fd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for k, v in body.model_dump().items():
        setattr(fd, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Key conflict")
    db.refresh(fd)
    return fd


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(
    field_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    fd = (
        db.query(FieldDefinition)
        .filter(FieldDefinition.id == field_id, FieldDefinition.company_id == company_id)
        .first()
    )
    if not fd:
        return
    # Soft delete: hide the field but keep historical values intact.
    fd.is_active = False
    db.commit()
