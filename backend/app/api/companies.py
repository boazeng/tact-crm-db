"""Companies management. Super admin only — tenants are top-level entities."""
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..deps import get_db, require_super_admin
from ..models import Company, User
from ..schemas.admin import CompanyIn, CompanyOut


router = APIRouter(prefix="/api/admin/companies", tags=["admin-companies"])

# 5-digit company numbers (like Priority), assigned at random so the value doesn't
# reveal how many companies exist or their join order.
COMPANY_NUMBER_MIN = 10000
COMPANY_NUMBER_MAX = 99999


def _generate_company_number(db: Session) -> int:
    """A random unused 5-digit company number. Retries on collision; falls back to
    scanning for the first free number if random draws keep colliding (only when
    the space is nearly full — not a realistic scale here)."""
    used = {
        n for (n,) in db.query(Company.company_number)
        .filter(Company.company_number.isnot(None)).all()
    }
    for _ in range(100):
        n = random.randint(COMPANY_NUMBER_MIN, COMPANY_NUMBER_MAX)
        if n not in used:
            return n
    for n in range(COMPANY_NUMBER_MIN, COMPANY_NUMBER_MAX + 1):
        if n not in used:
            return n
    raise HTTPException(
        status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
        detail="No free company number available",
    )


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return db.query(Company).order_by(Company.name).all()


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    body: CompanyIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    company = Company(**body.model_dump(), company_number=_generate_company_number(db))
    db.add(company)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Company slug '{body.slug}' already exists",
        )
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return company


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int,
    body: CompanyIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for k, v in body.model_dump().items():
        setattr(company, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Slug conflict"
        )
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return
    # Soft delete: mark inactive (preserves audit trail).
    company.is_active = False
    db.commit()
