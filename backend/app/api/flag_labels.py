"""Per-company display names for the fixed customer yes/no flags (flag1..flag3).

Any user in the company may read them (the customer form needs them); only a
company admin may change them. Flags left at their default `דגל N` are simply
not stored — GET fills those in on the fly."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_company_admin, resolve_company_id
from ..models import FlagLabel, FLAG_COUNT, User, default_flag_label
from ..schemas.flag_label import FlagLabelOut, FlagLabelsUpdate


router = APIRouter(prefix="/api/flag-labels", tags=["flag-labels"])


def _resolve(db: Session, company_id: int) -> list[FlagLabelOut]:
    """Return all FLAG_COUNT flags in order, custom label or default per flag."""
    stored = {
        r.flag_index: r
        for r in db.query(FlagLabel).filter(FlagLabel.company_id == company_id)
    }
    out = []
    for i in range(1, FLAG_COUNT + 1):
        row = stored.get(i)
        out.append(FlagLabelOut(
            flag_index=i,
            label=(row.label if row else None) or default_flag_label(i),
            is_active=row.is_active if row else True,
        ))
    return out


@router.get("", response_model=list[FlagLabelOut])
def list_labels(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return _resolve(db, company_id)


@router.put("", response_model=list[FlagLabelOut])
def update_labels(
    body: FlagLabelsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    existing = {
        r.flag_index: r
        for r in db.query(FlagLabel).filter(FlagLabel.company_id == company_id)
    }
    for item in body.labels:
        if not 1 <= item.flag_index <= FLAG_COUNT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"flag_index must be 1..{FLAG_COUNT}",
            )
        label = item.label.strip()
        row = existing.get(item.flag_index)
        is_default = not label or label == default_flag_label(item.flag_index)
        if is_default and item.is_active:
            if row:
                db.delete(row)
            continue
        resolved = label or default_flag_label(item.flag_index)
        if row:
            row.label = resolved
            row.is_active = item.is_active
        else:
            db.add(
                FlagLabel(
                    company_id=company_id, flag_index=item.flag_index,
                    label=resolved, is_active=item.is_active,
                )
            )
    db.commit()
    return _resolve(db, company_id)
