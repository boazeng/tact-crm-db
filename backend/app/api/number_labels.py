"""Per-company display names for the fixed customer numeric params (num1..num15).

Any user in the company may read them (the customer form needs them); only a
company admin may change them. Slots left at their default `מספר N` and active
are not stored — GET fills those in on the fly."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_company_admin, resolve_company_id
from ..models import NumberLabel, NUM_COUNT, User, default_number_label
from ..schemas.number_label import NumberLabelOut, NumberLabelsUpdate


router = APIRouter(prefix="/api/number-labels", tags=["number-labels"])


def _resolve(db: Session, company_id: int) -> list[NumberLabelOut]:
    stored = {
        r.num_index: r
        for r in db.query(NumberLabel).filter(NumberLabel.company_id == company_id)
    }
    out = []
    for i in range(1, NUM_COUNT + 1):
        row = stored.get(i)
        out.append(NumberLabelOut(
            num_index=i,
            label=(row.label if row else None) or default_number_label(i),
            is_active=row.is_active if row else True,
        ))
    return out


@router.get("", response_model=list[NumberLabelOut])
def list_labels(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return _resolve(db, company_id)


@router.put("", response_model=list[NumberLabelOut])
def update_labels(
    body: NumberLabelsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    existing = {
        r.num_index: r
        for r in db.query(NumberLabel).filter(NumberLabel.company_id == company_id)
    }
    for item in body.labels:
        if not 1 <= item.num_index <= NUM_COUNT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"num_index must be 1..{NUM_COUNT}",
            )
        label = item.label.strip()
        row = existing.get(item.num_index)
        is_default = not label or label == default_number_label(item.num_index)
        if is_default and item.is_active:
            if row:
                db.delete(row)
            continue
        resolved = label or default_number_label(item.num_index)
        if row:
            row.label = resolved
            row.is_active = item.is_active
        else:
            db.add(
                NumberLabel(
                    company_id=company_id, num_index=item.num_index,
                    label=resolved, is_active=item.is_active,
                )
            )
    db.commit()
    return _resolve(db, company_id)
