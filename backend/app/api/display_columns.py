"""Per-company choice of which customer fields appear as columns in the main
customers table (up to 3, picked from params / flags / lists).

Any user in the company may read them (the customers list needs them); only a
company admin may change them."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_company_admin, resolve_company_id
from ..models import (
    DisplayColumn,
    MAX_DISPLAY_COLUMNS,
    DEFAULT_DISPLAY_COLUMNS,
    PARAM_COUNT,
    FLAG_COUNT,
    LIST_COUNT,
    User,
)
from ..schemas.display_column import DisplayColumnOut, DisplayColumnsUpdate


router = APIRouter(prefix="/api/display-columns", tags=["display-columns"])

# Allowed (kind → max 1-based index) for validation.
_LIMITS = {"param": PARAM_COUNT, "flag": FLAG_COUNT, "list": LIST_COUNT}


def _resolve(db: Session, company_id: int) -> list[DisplayColumnOut]:
    rows = (
        db.query(DisplayColumn)
        .filter(DisplayColumn.company_id == company_id)
        .order_by(DisplayColumn.position)
        .all()
    )
    if not rows:
        return [DisplayColumnOut(kind=k, ref_index=i) for k, i in DEFAULT_DISPLAY_COLUMNS]
    return [DisplayColumnOut(kind=r.kind, ref_index=r.ref_index) for r in rows]


@router.get("", response_model=list[DisplayColumnOut])
def list_columns(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return _resolve(db, company_id)


@router.put("", response_model=list[DisplayColumnOut])
def update_columns(
    body: DisplayColumnsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    if len(body.columns) > MAX_DISPLAY_COLUMNS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At most {MAX_DISPLAY_COLUMNS} columns may be selected",
        )
    for c in body.columns:
        limit = _LIMITS.get(c.kind)
        if limit is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown column kind: {c.kind}",
            )
        if not 1 <= c.ref_index <= limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{c.kind} index must be 1..{limit}",
            )

    # Replace the company's column set with the new ordered list.
    db.query(DisplayColumn).filter(DisplayColumn.company_id == company_id).delete()
    for pos, c in enumerate(body.columns):
        db.add(
            DisplayColumn(
                company_id=company_id, position=pos, kind=c.kind, ref_index=c.ref_index
            )
        )
    db.commit()
    return _resolve(db, company_id)
